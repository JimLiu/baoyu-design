#!/usr/bin/env node
// claude-motion: local Artifact tool (prebuilt; do not edit).

import { createHash as createHash5 } from "node:crypto";
import fs19 from "node:fs";
import path18 from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

import { createHash } from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
var STATE_FILE = ".artifact-server.json";
var LOG_FILE = ".artifact-server.log";
var EXPORTS_DIR = "exports";
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
function writeState(state) {
  fs.writeFileSync(path.join(state.root, STATE_FILE), `${JSON.stringify(state, null, 2)}
`);
  writeGitignore(state.root, state.kind);
}
function removeState(root) {
  const state = readState(root);
  if (state && state.pid !== process.pid && alive(state.pid)) return;
  fs.rmSync(path.join(root, STATE_FILE), { force: true });
}
var GITIGNORE_FILE = ".gitignore";
var gitignoreLines = (kind) => [STATE_FILE, LOG_FILE, ".sharing.json", ...kind === "docs" ? [] : ["/history/"], `/${EXPORTS_DIR}/`, "*.tmp", ".tmp-*", ".DS_Store"];
function writeGitignore(root, kind) {
  const file = path.join(root, GITIGNORE_FILE);
  try {
    fs.writeFileSync(file, ["# Written by baoyu-design when the editor first opened this folder: what only this computer's editor server needs.", ...gitignoreLines(kind), ""].join("\n"), { flag: "wx" });
  } catch {
  }
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
var NetworkBlocked = class extends Error {
  code = "NETWORK_BLOCKED";
  constructor() {
    super(
      "A sandbox blocks local network here (127.0.0.1), so the server cannot start and no port is really in use. Run this same command with local network allowed, outside the sandbox, asking for that permission if your commands need approval."
    );
  }
};
function loopbackBlocked(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host: "127.0.0.1", port });
    const done = (blocked) => {
      socket.destroy();
      resolve(blocked);
    };
    socket.setTimeout(300, () => done(false));
    socket.once("connect", () => done(false));
    socket.once("error", (error) => done(error.code === "EPERM" || error.code === "EACCES"));
  });
}
var isBenchmarkRange = (address) => /^198\.1[89]\./.test(address);
function isTailnet(address) {
  const m = /^100\.(\d{1,3})\./.exec(address);
  return !!m && Number(m[1]) >= 64 && Number(m[1]) <= 127;
}
var isTunnel = (name) => /^(utun|tun|tap|wg|ppp|ipsec)\d/i.test(name);
function lanAddresses() {
  const out = /* @__PURE__ */ new Map();
  for (const [name, list] of Object.entries(os.networkInterfaces())) {
    for (const entry of list ?? []) {
      if (entry.family !== "IPv4" || entry.internal || entry.address.startsWith("169.254.") || isBenchmarkRange(entry.address)) continue;
      const rank = isTailnet(entry.address) ? 2 : isTunnel(name) ? 1 : 0;
      out.set(entry.address, Math.min(rank, out.get(entry.address) ?? rank));
    }
  }
  return [...out.keys()].sort((a, b) => out.get(a) - out.get(b));
}
function answers(host, port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const done = (taken) => {
      socket.destroy();
      resolve(taken);
    };
    socket.setTimeout(300, () => done(false));
    socket.once("connect", () => done(true));
    socket.once("error", (error) => done(!["ECONNREFUSED", "EADDRNOTAVAIL", "EAFNOSUPPORT", "ENETUNREACH", "EHOSTUNREACH"].includes(error.code ?? "")));
  });
}
async function answersAnyPort(address) {
  const server = net.createServer();
  let port;
  try {
    port = await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, address, () => {
        const bound = server.address();
        resolve(typeof bound === "object" && bound ? bound.port : 0);
      });
    });
  } catch {
    return false;
  } finally {
    await new Promise((resolve) => server.close(() => resolve()));
  }
  return port > 0 && answers(address, port);
}
async function listenFree(server, from, host, first) {
  if (await loopbackBlocked(first || from || 1)) throw new NetworkBlocked();
  if (from === 0) return listen(server, 0, host);
  const to = Math.min(from + PORT_TRIES - 1, 65535);
  const range = Array.from({ length: to - from + 1 }, (_, i) => from + i);
  const ports = first ? [first, ...range.filter((port) => port !== first)] : range;
  const wildcard = host === "0.0.0.0" || host === "::";
  const lan = lanAddresses().filter((address) => address !== host);
  const answering = await Promise.all(lan.map(answersAnyPort));
  const probes = [.../* @__PURE__ */ new Set([...wildcard ? [] : [host], "127.0.0.1", "::1", ...lan.filter((_, i) => !answering[i])])];
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
  const shown2 = host === "0.0.0.0" || host === "::" ? "127.0.0.1" : host.includes(":") ? `[${host}]` : host;
  return `http://${shown2}:${port}`;
}
var pagePathOf = (kind, root) => `/${kind}/${createHash("sha256").update(path.resolve(root)).digest("base64url").slice(0, 22)}/`;
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
var errorText = (error) => error instanceof Error ? error.message : String(error);

import { spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import fs3 from "node:fs";
import http from "node:http";
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

import { createHash as createHash2 } from "node:crypto";
var GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
var MAX_MESSAGE = 64 * 1024 * 1024;
var WebSocketConnection = class {
  socket;
  buffer = Buffer.alloc(0);
  parts = [];
  partOpcode = 0;
  closed = false;
  handlers = {};
  constructor(socket, head) {
    this.socket = socket;
    socket.on("data", (chunk) => this.receive(chunk));
    socket.on("close", () => this.finish());
    socket.on("error", () => this.finish());
    if (head.length) this.receive(head);
  }
  get open() {
    return !this.closed;
  }
  sendText(text) {
    this.send(1, Buffer.from(text, "utf8"));
  }
  sendBinary(data) {
    this.send(2, data);
  }
  close(code = 1e3, reason = "") {
    if (this.closed) return;
    const body = Buffer.alloc(2 + Buffer.byteLength(reason));
    body.writeUInt16BE(code, 0);
    body.write(reason, 2);
    this.send(8, body);
    this.socket.end();
    this.finish();
  }
  finish() {
    if (this.closed) return;
    this.closed = true;
    this.socket.destroy();
    this.handlers.close?.();
  }
  send(opcode, payload) {
    if (this.closed) return;
    const length = payload.length;
    let header;
    if (length < 126) {
      header = Buffer.from([128 | opcode, length]);
    } else if (length < 65536) {
      header = Buffer.alloc(4);
      header[0] = 128 | opcode;
      header[1] = 126;
      header.writeUInt16BE(length, 2);
    } else {
      header = Buffer.alloc(10);
      header[0] = 128 | opcode;
      header[1] = 127;
      header.writeBigUInt64BE(BigInt(length), 2);
    }
    this.socket.write(Buffer.concat([header, payload]));
  }
  receive(chunk) {
    this.buffer = this.buffer.length ? Buffer.concat([this.buffer, chunk]) : chunk;
    for (; ; ) {
      if (this.buffer.length < 2) return;
      const first = this.buffer[0];
      const second = this.buffer[1];
      const fin = (first & 128) !== 0;
      const opcode = first & 15;
      const masked = (second & 128) !== 0;
      let length = second & 127;
      let offset = 2;
      if (length === 126) {
        if (this.buffer.length < 4) return;
        length = this.buffer.readUInt16BE(2);
        offset = 4;
      } else if (length === 127) {
        if (this.buffer.length < 10) return;
        const big = this.buffer.readBigUInt64BE(2);
        if (big > BigInt(MAX_MESSAGE)) return this.close(1009, "message too big");
        length = Number(big);
        offset = 10;
      }
      const maskLength = masked ? 4 : 0;
      if (this.buffer.length < offset + maskLength + length) return;
      const mask = masked ? this.buffer.subarray(offset, offset + 4) : null;
      const payload = Buffer.from(this.buffer.subarray(offset + maskLength, offset + maskLength + length));
      if (mask) for (let index = 0; index < payload.length; index++) payload[index] = payload[index] ^ mask[index & 3];
      this.buffer = this.buffer.subarray(offset + maskLength + length);
      this.frame(fin, opcode, payload);
      if (this.closed) return;
    }
  }
  frame(fin, opcode, payload) {
    switch (opcode) {
      case 8:
        this.close(payload.length >= 2 ? payload.readUInt16BE(0) : 1e3);
        return;
      case 9:
        this.send(10, payload);
        return;
      case 10:
        return;
      case 0:
      case 1:
      case 2: {
        if (opcode !== 0) {
          this.parts = [];
          this.partOpcode = opcode;
        }
        this.parts.push(payload);
        if (this.parts.reduce((total, part) => total + part.length, 0) > MAX_MESSAGE) return this.close(1009, "message too big");
        if (!fin) return;
        const message = Buffer.concat(this.parts);
        this.parts = [];
        if (this.partOpcode === 1) this.handlers.text?.(message.toString("utf8"));
        else this.handlers.binary?.(message);
        return;
      }
      default:
        this.close(1002, "unknown opcode");
    }
  }
};
function acceptWebSocket(request, socket, head, protocol) {
  const key = request.headers["sec-websocket-key"];
  if (typeof key !== "string" || String(request.headers.upgrade).toLowerCase() !== "websocket") {
    socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
    return null;
  }
  const accept = createHash2("sha1").update(key + GUID).digest("base64");
  socket.write(["HTTP/1.1 101 Switching Protocols", "Upgrade: websocket", "Connection: Upgrade", `Sec-WebSocket-Accept: ${accept}`, ...protocol ? [`Sec-WebSocket-Protocol: ${protocol}`] : [], "", ""].join("\r\n"));
  return new WebSocketConnection(socket, head);
}

var HUB_ROUTE = "/__hub";
var STREAM_PROTOCOL = "baoyu-sse";
var STREAM_REFUSED = 4e3;
function buildOf(script2) {
  const real = fs3.realpathSync(script2);
  const { mtimeMs, size } = fs3.statSync(real);
  return `${real}:${mtimeMs}:${size}`;
}
var SiteClash = class extends Error {
};
var StreamResponse = class extends EventEmitter {
  status = 200;
  headersSent = false;
  writableEnded = false;
  destroyed = false;
  ws;
  constructor(ws) {
    super();
    this.ws = ws;
  }
  writeHead(status) {
    this.status = status;
    this.headersSent = true;
    return this;
  }
  setHeader() {
    return this;
  }
  flushHeaders() {
  }
  write(chunk) {
    if (this.status === 200 && !this.writableEnded) this.ws.sendText(String(chunk));
    return true;
  }
  end(chunk) {
    if (this.writableEnded) return this;
    if (chunk !== void 0) this.write(chunk);
    this.writableEnded = true;
    this.ws.close(this.status === 200 ? 1e3 : STREAM_REFUSED + Math.min(this.status, 999));
    return this;
  }
  destroy() {
    this.destroyed = true;
    return this.end();
  }
  closed() {
    this.writableEnded = true;
    this.emit("close");
  }
};
var Hub = class {
  port = 0;
  kind;
  host;
  build;
  factory;
  /** Sites' logs go to its stderr too: it runs in someone's terminal, not in the background. */
  echo;
  server;
  /** page → site. */
  sites = /* @__PURE__ */ new Map();
  adding = /* @__PURE__ */ new Map();
  startedAt = /* @__PURE__ */ new Map();
  hosts = /* @__PURE__ */ new Set();
  /** One listener per LAN address while any site is open to the network. */
  lanServers = /* @__PURE__ */ new Map();
  network;
  constructor(options) {
    this.echo = options.echo;
    this.kind = options.kind;
    this.build = options.build;
    this.host = options.host;
    this.factory = options.site;
    this.server = this.createServer();
    const hub = this;
    this.network = {
      get port() {
        return hub.port;
      },
      addresses: () => [...this.lanServers.keys()],
      open: () => this.openLan(),
      release: () => this.releaseLan()
    };
  }
  createServer() {
    const server = http.createServer((request, response) => {
      this.onRequest(request, response).catch((error) => {
        process.stderr.write(`[${(/* @__PURE__ */ new Date()).toISOString()}] request failed: ${error instanceof Error ? error.stack ?? error.message : String(error)}
`);
        if (!response.headersSent) sendJson(response, 500, { code: "internal", message: "internal error" });
        else response.destroy();
      });
    });
    server.on("upgrade", (request, socket, head) => this.onUpgrade(request, socket, head));
    return server;
  }
  /** Listens at the first free port from `port`; `first` is tried before them. */
  async listen(port, first) {
    this.port = await listenFree(this.server, port, this.host, first);
    const named = this.host === "0.0.0.0" || this.host === "::" ? [] : [this.host.includes(":") ? `[${this.host}]:${this.port}` : `${this.host}:${this.port}`];
    this.hosts = /* @__PURE__ */ new Set([`127.0.0.1:${this.port}`, `localhost:${this.port}`, `[::1]:${this.port}`, ...named]);
    return this.port;
  }
  /** Ends every site and the listeners; what the folders' state files say goes with them. */
  close() {
    for (const site of [...this.sites.values()]) this.drop(site);
    this.closeLan();
    this.server.close();
    this.server.closeAllConnections?.();
  }
  /** On a signal (or a stray error, logged): every site's record goes and the process exits. */
  ownProcess() {
    const shutdown = () => {
      this.close();
      process.exit(0);
    };
    for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) process.on(signal, shutdown);
    const stray = (error) => process.stderr.write(`[${(/* @__PURE__ */ new Date()).toISOString()}] uncaught: ${error instanceof Error ? error.stack ?? error.message : String(error)}
`);
    process.on("uncaughtException", stray);
    process.on("unhandledRejection", stray);
  }
  // ---- the sites -------------------------------------------------------------------------------------------------
  urlOf(site) {
    return `${serverOrigin(this.host, this.port)}${site.page}`;
  }
  stateOf(site) {
    const lan = site.share.lanUrls();
    return { pid: process.pid, url: this.urlOf(site), port: this.port, root: site.root, kind: this.kind, startedAt: this.startedAt.get(site.page) ?? (/* @__PURE__ */ new Date()).toISOString(), ...lan.length ? { lan } : {} };
  }
  /** Mounts a folder (already mounted: the same site), writing its <root>/.artifact-server.json. */
  add(root, options) {
    const mounted = [...this.sites.values()].find((site) => site.root === root);
    if (mounted) return (options.lan && !mounted.share.shared ? mounted.share.setLan(true) : Promise.resolve()).then(() => this.stateOf(mounted));
    const adding = this.adding.get(root);
    if (adding) return adding;
    const work = this.mount(root, options).finally(() => this.adding.delete(root));
    this.adding.set(root, work);
    return work;
  }
  async mount(root, { agentHook, lan = false }) {
    const file = path3.join(root, LOG_FILE);
    const log3 = (line) => {
      const text = `[${(/* @__PURE__ */ new Date()).toISOString()}] ${line}
`;
      try {
        fs3.appendFileSync(file, text);
      } catch {
      }
      if (this.echo) process.stderr.write(text);
    };
    const site = await this.factory(root, { log: log3, network: this.network, ...agentHook ? { agentHook } : {} });
    const other = this.sites.get(site.page);
    if (other) {
      site.close();
      throw new SiteClash(`${other.root} is already open at ${site.page}.`);
    }
    this.sites.set(site.page, site);
    this.startedAt.set(site.page, (/* @__PURE__ */ new Date()).toISOString());
    try {
      await site.share.start(lan);
    } catch (error) {
      this.drop(site);
      throw error;
    }
    const state = this.stateOf(site);
    const { lan: _lan, ...record } = state;
    writeState(record);
    log3(`serving ${root} at ${state.url}${agentHook ? `; each comment sent to the agent runs: ${agentHook}` : ""}`);
    return state;
  }
  drop(site) {
    this.sites.delete(site.page);
    this.startedAt.delete(site.page);
    removeState(site.root);
    site.close();
  }
  /** Ends one site; true when one was mounted there. The process ends with its last site. */
  remove(root) {
    const site = [...this.sites.values()].find((candidate) => candidate.root === root);
    if (site) this.drop(site);
    return site !== void 0;
  }
  // ---- the network side ------------------------------------------------------------------------------------------
  async openLan() {
    const addresses = lanAddresses().filter((address) => !this.lanServers.has(address));
    const answering = await Promise.all(addresses.map(answersAnyPort));
    for (const address of addresses.filter((_, i) => !answering[i])) {
      const server = this.createServer();
      try {
        await listen(server, this.port, address);
        this.lanServers.set(address, server);
      } catch (error) {
        server.close();
        process.stderr.write(`[${(/* @__PURE__ */ new Date()).toISOString()}] not listening on ${address}:${this.port}: ${errorText(error)}
`);
      }
    }
    return [...this.lanServers.keys()];
  }
  /** A site stopped sharing: the listeners stay while another is shared. */
  releaseLan() {
    if (![...this.sites.values()].some((site) => site.share.shared)) this.closeLan();
  }
  closeLan() {
    for (const server of this.lanServers.values()) {
      server.close();
      server.closeAllConnections?.();
    }
    this.lanServers.clear();
  }
  /** A Host header this hub answers: its own names, and while something is shared, its LAN addresses and machine name. */
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
  // ---- requests --------------------------------------------------------------------------------------------------
  /** The site whose address `pathname` is under, with the path below it. */
  under(pathname) {
    const [, first, second] = pathname.split("/");
    const site = first && second ? this.sites.get(`/${first}/${second}/`) : void 0;
    if (site) return { site, rest: pathname.slice(site.page.length - 1) };
    for (const candidate of this.sites.values()) if (candidate.claims?.(pathname)) return { site: candidate, rest: pathname };
    return null;
  }
  /** The site a page at this request's Referer belongs to. */
  referred(request) {
    const referer = request.headers.referer;
    if (typeof referer !== "string") return null;
    try {
      const at = new URL(referer);
      return at.host === request.headers.host ? this.under(at.pathname)?.site ?? null : null;
    } catch {
      return null;
    }
  }
  /** The sites this request's person may see. */
  seenBy(request) {
    return [...this.sites.values()].filter((site) => site.share.viewerOf(request));
  }
  async onRequest(request, response) {
    if (!this.hostAllowed(request)) {
      request.resume();
      response.writeHead(421, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" }).end("Misdirected request");
      return;
    }
    const url = new URL(request.url ?? "/", "http://local");
    const pathname = url.pathname;
    if (pathname === HUB_ROUTE) return this.control(request, response);
    if (pathname === "/favicon.ico") {
      response.writeHead(204).end();
      return;
    }
    if (pathname === "/" || pathname === "/index.html") return this.landing(request, response, url.search);
    const at = this.under(pathname);
    if (at) {
      if (at.rest === "") {
        request.resume();
        response.writeHead(308, { Location: `${pathname}/${url.search}`, "Cache-Control": "no-store" }).end();
        return;
      }
      request.url = `${at.rest}${url.search}`;
      return at.site.handle(request, response);
    }
    const site = await this.answering(request, pathname);
    if (site) return site.handle(request, response);
    request.resume();
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" }).end("Not found");
  }
  /** The site that answers a path outside every site's address. */
  async answering(request, pathname) {
    const link = /^\/s\/([A-Za-z0-9_-]{16,64})$/.exec(pathname);
    if (link) return [...this.sites.values()].find((site) => site.share.sharing.linkRole(link[1])) ?? null;
    const blob = /^\/_blob\/([0-9a-f]{32})$/.exec(pathname);
    if (blob) {
      const referred = this.referred(request);
      const seen = this.seenBy(request);
      for (const site of referred && seen.includes(referred) ? [referred, ...seen] : seen) if (await site.hasBlob?.(blob[1])) return site;
      return null;
    }
    for (const site of this.sites.values()) if (site.common?.(pathname)) return site;
    return this.referred(request);
  }
  /** `/`: where this person goes. */
  landing(request, response, search) {
    const seen = this.seenBy(request);
    const only = seen[0];
    if (seen.length === 1 && only) {
      request.resume();
      response.writeHead(302, { Location: `${only.page}${search}`, "Cache-Control": "no-store" }).end();
      return;
    }
    const any = only ?? [...this.sites.values()][0];
    if (!any) {
      request.resume();
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" }).end("Nothing is open here.");
      return;
    }
    if (!only) return any.share.denied(request, response);
    any.share.sendList(response, seen.map((site) => ({ page: site.page, title: site.share.title() })));
  }
  /** The CLIs' route: over loopback, from a process (a browser's POST carries an Origin). */
  async control(request, response) {
    const info = { hub: 1, kind: this.kind, build: this.build, host: this.host, pid: process.pid };
    if (!isLoopback(request.socket.remoteAddress) || request.headers.origin !== void 0) {
      request.resume();
      return sendJson(response, 403, { code: "not_granted", message: "Only a local process can do this." });
    }
    if (request.method === "GET") return sendJson(response, 200, info);
    if (request.method !== "POST") {
      request.resume();
      return sendJson(response, 405, { code: "method_not_allowed", message: "GET or POST." });
    }
    let body;
    try {
      body = JSON.parse((await readBody(request, 64 << 10)).toString("utf8"));
    } catch {
      return sendJson(response, 400, { code: "invalid_argument", message: "The call is not JSON." });
    }
    if (typeof body.root !== "string" || !path3.isAbsolute(body.root)) return sendJson(response, 400, { code: "invalid_argument", message: "root: an absolute path." });
    if (body.action === "mount") {
      try {
        const state = await this.add(body.root, { ...typeof body.agentHook === "string" && body.agentHook ? { agentHook: body.agentHook } : {}, lan: body.lan === true });
        return sendJson(response, 200, { ...info, state });
      } catch (error) {
        sendJson(response, error instanceof SiteClash ? 409 : 400, { ...info, code: error.code ?? "SERVER_FAILED", message: errorText(error) });
        return this.endIfEmpty();
      }
    }
    if (body.action === "unmount") {
      const removed = this.remove(body.root);
      const remaining = this.sites.size;
      sendJson(response, 200, { ...info, removed, remaining });
      return this.endIfEmpty();
    }
    return sendJson(response, 400, { code: "invalid_argument", message: "action: mount or unmount." });
  }
  /** The process ends with its last site. */
  endIfEmpty() {
    if (this.sites.size > 0 || this.adding.size > 0) return;
    this.close();
    setImmediate(() => process.exit(0));
  }
  onUpgrade(request, socket, head) {
    socket.on("error", () => {
    });
    const url = new URL(request.url ?? "/", "http://local");
    const at = this.hostAllowed(request) && this.originOk(request) ? this.under(url.pathname) : null;
    if (!at) {
      socket.end("HTTP/1.1 403 Forbidden\r\n\r\n");
      return;
    }
    request.url = `${at.rest}${url.search}`;
    const asked = String(request.headers["sec-websocket-protocol"] ?? "").split(",").map((p) => p.trim());
    if (asked.includes(STREAM_PROTOCOL)) return this.stream(at.site, request, socket, head, url);
    if (at.site.upgrade) return at.site.upgrade(request, socket, head);
    socket.end("HTTP/1.1 404 Not Found\r\n\r\n");
  }
  originOk(request) {
    const origin = request.headers.origin;
    if (origin === void 0) return true;
    try {
      return new URL(origin).host === request.headers.host;
    } catch {
      return false;
    }
  }
  /** An event stream over a WebSocket: the site's handler answers it as a GET. */
  stream(site, request, socket, head, url) {
    const ws = acceptWebSocket(request, socket, head, STREAM_PROTOCOL);
    if (!ws) return;
    const last = url.searchParams.get("__lastEventId");
    if (last !== null) {
      request.headers["last-event-id"] = last;
      url.searchParams.delete("__lastEventId");
      request.url = `${request.url?.split("?")[0]}${url.search}`;
    }
    request.method = "GET";
    const response = new StreamResponse(ws);
    ws.handlers = {
      close: () => {
        response.closed();
        request.emit("close");
      }
    };
    Promise.resolve(site.handle(request, response)).catch(() => ws.close(STREAM_REFUSED + 500));
  }
};
async function hubAt(origin) {
  try {
    const response = await fetch(`${origin}${HUB_ROUTE}`, { signal: AbortSignal.timeout(1e3) });
    if (!response.ok) return null;
    const info = await response.json();
    return info.hub === 1 ? info : null;
  } catch {
    return null;
  }
}
async function joinHub(call, below = Infinity) {
  if (call.port === 0) return null;
  const ports = call.portGiven ? [call.port] : Array.from({ length: PORT_TRIES }, (_, i) => call.port + i).filter((port) => port <= 65535 && port < below);
  const build = buildOf(call.script);
  const origins = ports.map((port) => serverOrigin(call.host, port));
  const infos = await Promise.all(origins.map(hubAt));
  for (const [i, info] of infos.entries()) {
    if (!info || info.kind !== call.kind || info.build !== build || info.host !== call.host) continue;
    const response = await fetch(`${origins[i]}${HUB_ROUTE}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mount", root: call.root, ...call.agentHook ? { agentHook: call.agentHook } : {}, lan: call.lan === true }),
      signal: AbortSignal.timeout(2e4)
    }).catch(() => null);
    if (!response) continue;
    const body = await response.json().catch(() => ({}));
    if (response.ok && body.state) return body.state;
    if (response.status === 409) continue;
    throw Object.assign(new Error(body.message ?? `the server answered ${response.status}`), { code: body.code ?? "SERVER_FAILED" });
  }
  return null;
}
async function leaveHub(state) {
  let remaining = 0;
  const response = await fetch(`${new URL(state.url).origin}${HUB_ROUTE}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "unmount", root: state.root }),
    signal: AbortSignal.timeout(5e3)
  }).catch(() => null);
  const body = response ? await response.json().catch(() => null) : null;
  if (body?.hub === 1) remaining = Number(body.remaining ?? 0);
  else if (alive(state.pid)) process.kill(state.pid, "SIGTERM");
  const deadline = Date.now() + 5e3;
  while (remaining === 0 && alive(state.pid) && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 100));
  if (remaining === 0 && alive(state.pid)) return false;
  fs3.rmSync(path3.join(state.root, STATE_FILE), { force: true });
  return true;
}
function holdSite(state) {
  const leave = () => {
    void leaveHub(state).finally(() => process.exit(0));
  };
  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) process.on(signal, leave);
  setInterval(() => {
    if (!alive(state.pid) || readState(state.root)?.pid !== state.pid) process.exit(0);
  }, 2e3);
}
async function serveHub(call) {
  const joined = await joinHub(call);
  const stayed = (state) => {
    if (!call.background) holdSite(state);
    return { ...state, joined: true };
  };
  if (joined) return stayed(joined);
  const hub = new Hub({ kind: call.kind, build: buildOf(call.script), host: call.host, site: call.site, echo: !call.background });
  const { state: sharing } = new Sharing(call.root);
  const linksPort = !call.portGiven && (call.lan || sharing.lan) ? sharing.port : void 0;
  const port = await hub.listen(call.port, linksPort);
  const lower = call.portGiven ? null : await joinHub(call, port);
  if (lower) {
    hub.close();
    return stayed(lower);
  }
  hub.ownProcess();
  try {
    return { ...await hub.add(call.root, { ...call.agentHook ? { agentHook: call.agentHook } : {}, lan: call.lan === true }), joined: false };
  } catch (error) {
    hub.close();
    throw error;
  }
}
async function openOnHub(call) {
  if (await loopbackBlocked(call.port || 1)) throw new NetworkBlocked();
  const joined = await joinHub(call);
  if (joined) return { state: joined };
  const logFile = path3.join(call.root, LOG_FILE);
  const fd = fs3.openSync(logFile, "a");
  const child = spawn(process.execPath, [...call.command, "--background"], { detached: true, stdio: ["ignore", "ignore", fd] });
  child.unref();
  fs3.closeSync(fd);
  let exited = false;
  child.once("exit", () => exited = true);
  const deadline = Date.now() + 15e3;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 120));
    const state = await call.running();
    if (state) return { state };
    if (exited && !readState(call.root)) break;
  }
  return { tail: fs3.existsSync(logFile) ? fs3.readFileSync(logFile, "utf8").split("\n").slice(-12).join("\n") : "" };
}

import { createHash as createHash3 } from "node:crypto";
import fs6 from "node:fs";
import os4 from "node:os";
import path6 from "node:path";

import fs4 from "node:fs";
import fsp from "node:fs/promises";
import path4 from "node:path";
import { promisify } from "node:util";
import zlib from "node:zlib";
var LOCAL_FILES = /* @__PURE__ */ new Set([STATE_FILE, LOG_FILE, SHARING_FILE]);
var LOCAL_DIRS = /* @__PURE__ */ new Set([EXPORTS_DIR]);
var JUNK_FILES = /* @__PURE__ */ new Set([".DS_Store", "Thumbs.db", "desktop.ini", ".git"]);
var isTemp = (name) => name.endsWith(".tmp") || name.startsWith(".tmp-");
var STORED = /* @__PURE__ */ new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".heic", ".mp4", ".m4v", ".mov", ".webm", ".mp3", ".m4a", ".aac", ".ogg", ".opus", ".flac", ".woff", ".woff2", ".zip", ".gz", ".br", ".zst", ".7z"]);
var MAX_ENTRIES = 65535;
var MAX_BYTES = 4294967295;
var ArchiveTooLarge = class extends Error {
  code = "TOO_LARGE";
};
async function archiveEntries(root, skip = []) {
  const folder = path4.basename(path4.resolve(root)) || "artifact";
  const skipped = new Set(skip.map((file) => path4.resolve(file)));
  const entries = [];
  const walk = async (dir, rel) => {
    let names;
    try {
      names = await fsp.readdir(dir, { withFileTypes: true });
    } catch (error) {
      if (rel && error.code === "ENOENT") return;
      throw error;
    }
    for (const dirent of names.sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)) {
      const name = dirent.name;
      if (JUNK_FILES.has(name) || isTemp(name) || !rel && (LOCAL_FILES.has(name) || LOCAL_DIRS.has(name) && dirent.isDirectory())) continue;
      const file = path4.join(dir, name);
      if (skipped.has(file)) continue;
      const inner = rel ? `${rel}/${name}` : name;
      if (dirent.isDirectory()) await walk(file, inner);
      else if (dirent.isFile()) {
        const stat = await fsp.stat(file).catch(() => null);
        if (stat?.isFile()) entries.push({ name: `${folder}/${inner}`, file, size: stat.size, mode: stat.mode & 511, mtime: stat.mtime });
      }
    }
  };
  await walk(path4.resolve(root), "");
  if (entries.length > MAX_ENTRIES) throw new ArchiveTooLarge(`The folder holds ${entries.length} files, more than a zip holds (${MAX_ENTRIES}); copy the folder itself instead.`);
  const bound = entries.reduce((sum, entry) => sum + entry.size + 2 * (46 + Buffer.byteLength(entry.name)), 22);
  if (bound > MAX_BYTES) throw new ArchiveTooLarge(`The folder holds ${(bound / 2 ** 30).toFixed(1)} GiB, more than a zip holds (4 GiB); copy the folder itself instead.`);
  return entries;
}
var CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 3988292384 ^ c >>> 1 : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();
function crc32(bytes) {
  let crc = 4294967295;
  for (let i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 255] ^ crc >>> 8;
  return (crc ^ 4294967295) >>> 0;
}
function dosTime(date) {
  const year = date.getFullYear();
  if (year < 1980) return { time: 0, date: 1 << 5 | 1 };
  if (year > 2107) return { time: 23 << 11 | 59 << 5 | 29, date: 127 << 9 | 12 << 5 | 31 };
  return {
    time: date.getHours() << 11 | date.getMinutes() << 5 | date.getSeconds() >> 1,
    date: year - 1980 << 9 | date.getMonth() + 1 << 5 | date.getDate()
  };
}
var deflateRaw = promisify(zlib.deflateRaw);
var UTF8 = 1 << 11;
async function writeZip(entries, write) {
  const central = [];
  let offset = 0;
  const put = async (chunk) => {
    await write(chunk);
    offset += chunk.length;
  };
  for (const entry of entries) {
    let data;
    try {
      data = entry.data ?? await fsp.readFile(entry.file);
    } catch (error) {
      if (error.code === "ENOENT") continue;
      throw error;
    }
    const crc = crc32(data);
    let method = 0;
    let body = data;
    if (data.length > 0 && !STORED.has(path4.extname(entry.name).toLowerCase())) {
      const deflated = await deflateRaw(data);
      if (deflated.length < data.length) {
        method = 8;
        body = deflated;
      }
    }
    if (offset + body.length > MAX_BYTES) throw new ArchiveTooLarge("The folder grew past what a zip holds (4 GiB) while it was being zipped.");
    const name = Buffer.from(entry.name, "utf8");
    const { time, date } = dosTime(entry.mtime);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(67324752, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(UTF8, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    const header = Buffer.alloc(46);
    header.writeUInt32LE(33639248, 0);
    header.writeUInt16LE(3 << 8 | 20, 4);
    header.writeUInt16LE(20, 6);
    header.writeUInt16LE(UTF8, 8);
    header.writeUInt16LE(method, 10);
    header.writeUInt16LE(time, 12);
    header.writeUInt16LE(date, 14);
    header.writeUInt32LE(crc, 16);
    header.writeUInt32LE(body.length, 20);
    header.writeUInt32LE(data.length, 24);
    header.writeUInt16LE(name.length, 28);
    header.writeUInt32LE((32768 | (entry.mode || 420) | 384) << 16 >>> 0, 38);
    header.writeUInt32LE(offset, 42);
    central.push(header, name);
    await put(Buffer.concat([local, name]));
    await put(body);
  }
  const start = offset;
  const directory = Buffer.concat(central);
  await put(directory);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(101010256, 0);
  end.writeUInt16LE(central.length / 2, 8);
  end.writeUInt16LE(central.length / 2, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(start, 16);
  await put(end);
  return offset;
}
function archiveFileName(root, now = /* @__PURE__ */ new Date()) {
  const day = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return `${path4.basename(path4.resolve(root)) || "artifact"}-${day}.zip`;
}
async function writeArchive(root, out) {
  const file = path4.resolve(out);
  const entries = await archiveEntries(root, [file]);
  const tmp = path4.join(path4.dirname(file), `.${path4.basename(file)}.${process.pid}.tmp`);
  const handle = await fsp.open(tmp, "w");
  let bytes;
  try {
    bytes = await writeZip(entries, async (chunk) => {
      await handle.write(chunk);
    });
    await handle.close();
  } catch (error) {
    await handle.close().catch(() => {
    });
    await fsp.rm(tmp, { force: true });
    throw error;
  }
  await fsp.rename(tmp, file);
  return { file, files: entries.length, bytes };
}
async function archiveCommand(root, out) {
  const where = out ? path4.resolve(out) : path4.dirname(path4.resolve(root));
  const target = fs4.statSync(where, { throwIfNoEntry: false })?.isDirectory() ? path4.join(where, archiveFileName(root)) : where;
  const { file, files, bytes } = await writeArchive(root, target);
  return { file, folder: path4.basename(path4.resolve(root)), files, bytes, leftOut: [...LOCAL_FILES] };
}
function attachment(name) {
  const ascii = name.replace(/[^\x20-\x7e]|["\\]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}
async function sendArchive(request, response, root) {
  request.resume();
  let entries;
  try {
    entries = await archiveEntries(root);
  } catch (error) {
    const text = JSON.stringify({ code: error instanceof ArchiveTooLarge ? "too_large" : "upstream_error", message: error instanceof Error ? error.message : String(error) });
    response.writeHead(error instanceof ArchiveTooLarge ? 413 : 500, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }).end(text);
    return;
  }
  response.writeHead(200, {
    "Content-Type": "application/zip",
    "Content-Disposition": attachment(archiveFileName(root)),
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  });
  if (request.method === "HEAD") {
    response.end();
    return;
  }
  const write = (chunk) => new Promise((resolve, reject) => {
    if (response.destroyed) return reject(new Error("The download was cancelled."));
    if (response.write(chunk)) return resolve();
    const drained = () => {
      response.off("close", closed);
      resolve();
    };
    const closed = () => {
      response.off("drain", drained);
      reject(new Error("The download was cancelled."));
    };
    response.once("drain", drained);
    response.once("close", closed);
  });
  try {
    await writeZip(entries, write);
    response.end();
  } catch {
    response.destroy();
  }
}

import fs5 from "node:fs";
import fsp2 from "node:fs/promises";
import os3 from "node:os";
import path5 from "node:path";
var MAX_BYTES2 = 4294967295;
function shown(file) {
  const home = os3.homedir();
  return home && (file === home || file.startsWith(home + path5.sep)) ? `~${file.slice(home.length)}` : file;
}
function saved(file, bytes) {
  return { path: file, name: path5.basename(file), folder: path5.dirname(file), shown: shown(file), bytes };
}
function safeFileName(raw) {
  let name = (raw.replace(/\\/g, "/").split("/").pop() ?? "").replace(/[\u0000-\u001f\u007f<>:"|?*]/g, "_").replace(/^[.\s]+|[.\s]+$/g, "");
  if (name.length > 200) {
    const ext = path5.extname(name).slice(0, 16);
    name = name.slice(0, 200 - ext.length) + ext;
  }
  return name || "download";
}
async function openFree(dir, name) {
  const ext = path5.extname(name);
  const stem = name.slice(0, name.length - ext.length);
  for (let n = 0; ; n++) {
    const file = path5.join(dir, n === 0 ? name : `${stem} (${n})${ext}`);
    try {
      return { file, handle: await fsp2.open(file, "wx") };
    } catch (error) {
      if (error.code !== "EEXIST" || n >= 999) throw error;
    }
  }
}
async function saveDownload(request, response, root) {
  const declared = Number(request.headers["content-length"]);
  if (Number.isFinite(declared) && declared > MAX_BYTES2) {
    request.resume();
    return sendJson(response, 413, { code: "too_large", message: "The file is over 4 GiB." });
  }
  const name = safeFileName(new URL(request.url ?? "/", "http://local").searchParams.get("name") ?? "");
  let file = "";
  let handle = null;
  let bytes = 0;
  try {
    const dir = path5.join(root, EXPORTS_DIR);
    await fsp2.mkdir(dir, { recursive: true });
    ({ file, handle } = await openFree(dir, name));
    for await (const chunk of request) {
      bytes += chunk.length;
      if (bytes > MAX_BYTES2) throw Object.assign(new Error("The file is over 4 GiB."), { status: 413 });
      await handle.write(chunk);
    }
    await handle.close();
    handle = null;
  } catch (error) {
    await handle?.close().catch(() => {
    });
    if (file) await fsp2.rm(file, { force: true });
    request.resume();
    const status = error.status ?? 500;
    if (!response.headersSent) sendJson(response, status, { code: status === 413 ? "too_large" : "upstream_error", message: error instanceof Error ? error.message : String(error) });
    return;
  }
  sendJson(response, 200, saved(file, bytes));
}
async function saveArchive(request, response, root) {
  request.resume();
  try {
    const { file } = await archiveCommand(root, void 0);
    sendJson(response, 200, saved(file, fs5.statSync(file).size));
  } catch (error) {
    const tooLarge = error instanceof ArchiveTooLarge;
    sendJson(response, tooLarge ? 413 : 500, { code: tooLarge ? "too_large" : "upstream_error", message: error instanceof Error ? error.message : String(error) });
  }
}

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
function localOwner() {
  let name = "You";
  try {
    name = os4.userInfo().username.trim() || name;
  } catch {
  }
  return { id: "local", name, email: `${name}@localhost` };
}
var guestCookieName = (kind, root) => `${kind.replace(/-/g, "_")}_guest_${createHash3("sha256").update(path6.resolve(root)).digest("hex").slice(0, 12)}`;
function dbAccess(viewer, segs, adminRead = /* @__PURE__ */ new Set()) {
  const admin = canEditAs(viewer.role);
  const read = segs[0] === "data" && segs[1] === "users" && segs.length > 2 ? segs[2] === viewer.user.id : admin || !adminRead.has(segs[0] ?? "");
  return { read, write: read && admin };
}
var ShareHost = class {
  sharing;
  options;
  network;
  page;
  /** Open to the local network now (the hub's listeners are up, for this artifact too). */
  on = false;
  live = /* @__PURE__ */ new Set();
  constructor(options) {
    this.options = options;
    this.network = options.network;
    this.page = options.page;
    this.sharing = new Sharing(options.root);
  }
  get port() {
    return this.network.port;
  }
  /** The hub took the artifact: open to the network now with `lan`, or if it was left shared. */
  async start(lan = false) {
    const { state } = this.sharing;
    if (!lan && !state.lan) return;
    if (state.port && state.port !== this.port) this.options.log(`port ${state.port} (the shared links') is not this server's; it is on ${this.port}: give the new links out again`);
    await this.setLan(true);
  }
  /** The artifact at each LAN address it is shared on ([] while it is not). */
  lanUrls() {
    return this.on ? this.network.addresses().map((a) => `http://${a}:${this.port}${this.page}`) : [];
  }
  /** Open to the local network now. */
  get shared() {
    return this.on;
  }
  /** The artifact's name, for the join page and the list of what is open at the server's root. */
  title() {
    return this.options.title();
  }
  /**
   * Opens the artifact to the local network or closes it, and returns the addresses it is on. Guests already in keep
   * their place for when it opens again.
   */
  async setLan(on) {
    if (!on) {
      this.on = false;
      this.network.release();
      for (const live of [...this.live]) if (live.viewer.guest) live.close("unshared");
      if (this.sharing.state.lan) this.sharing.setLan(false);
      return [];
    }
    const addresses = await this.network.open();
    this.on = addresses.length > 0;
    if (!this.sharing.state.lan || this.sharing.state.port !== this.port) this.sharing.setLan(true, this.port);
    this.options.log(`shared on the local network: ${addresses.map((a) => `http://${a}:${this.port}${this.page}`).join(", ") || "(no LAN address)"}`);
    return addresses;
  }
  /** The artifact left the hub: it stays shared in .sharing.json, for the next time it opens. */
  close() {
    this.on = false;
    this.network.release();
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
  isLocal(request) {
    return this.options.local ? this.options.local(request) : isLoopback(request.socket.remoteAddress);
  }
  viewerOf(request) {
    if (this.isLocal(request)) return { role: "owner", user: this.options.owner };
    const guest = this.on ? this.sharing.guest(this.cookie(request)) : null;
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
    return !viewer.guest || this.on && this.sharing.valid(viewer.guest);
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
      const body = this.bootScript(viewer, new URL(request.url ?? "/", "http://local").searchParams);
      response.writeHead(200, { "Content-Type": "text/javascript; charset=utf-8", "Content-Length": Buffer.byteLength(body), "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" }).end(body);
      return true;
    }
    if (method === "GET" && p === "/__share/invite") return sendJson(response, 200, this.invites(viewer, request.headers.host ?? "")), true;
    if (method === "GET" && p === "/__share/ui.js") {
      fs6.stat(this.options.uiFile, (error, stat) => {
        if (error || !stat.isFile()) return sendJson(response, 404, { code: "not_found", message: "The Share panel is missing." });
        sendFile(request, response, this.options.uiFile, { "Content-Type": "text/javascript; charset=utf-8", "Content-Length": stat.size, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
      });
      return true;
    }
    if (viewer.role !== "owner") return sendJson(response, 403, { code: "not_granted", message: "Only the owner can do this." }), true;
    if ((method === "GET" || method === "HEAD") && p === "/__share/archive") return await sendArchive(request, response, this.options.root), true;
    if (method === "POST" && p === "/__share/archive") return await saveArchive(request, response, this.options.root), true;
    if (method === "POST" && p === "/__share/save") return await saveDownload(request, response, this.options.root), true;
    if (p === "/__share") return await this.shareApi(request, response, method), true;
    sendJson(response, 404, { code: "not_found", message: "Not found" });
    return true;
  }
  /**
   * The tags a page puts first in its <head>: the boot script and the Share panel (the owner's, or a guest's). `query`
   * ("?…") goes to the boot script, for `globals`.
   */
  headTags(_viewer, query = "") {
    let tags = `<script src="${this.page}__share/boot.js${query.replace(/[<>"']/g, "").replace(/&/g, "&amp;")}"></script>`;
    if (fs6.existsSync(this.options.uiFile)) tags += `<script type="module" src="${this.page}__share/ui.js"></script>`;
    return tags;
  }
  /** `html` with the head tags first in its <head>; null when it has none. */
  injectHead(html, viewer, query = "") {
    const at = html.search(/<head(\s[^>]*)?>/i);
    if (at < 0) return null;
    const end = html.indexOf(">", at) + 1;
    return html.slice(0, end) + this.headTags(viewer, query) + html.slice(end);
  }
  /** What the page runs before anything else (see ROOT_SHIM, SECURE_CONTEXT_SHIM and GUEST_WATCH). */
  bootScript(viewer, query = new URLSearchParams()) {
    const share2 = { ...this.me(viewer), noun: this.options.noun, title: this.options.title(), ...this.options.reactions ? { reactions: true } : {} };
    let js = `(function(BASE){${ROOT_SHIM}})(${script(this.page)});${SECURE_CONTEXT_SHIM}window.__baoyuShare=${script(share2)};`;
    for (const [name, value] of Object.entries(this.options.globals?.(viewer, query) ?? {})) js += `window[${script(name)}]=${script(value)};`;
    if (this.options.agentName) js += `window.__baoyuAgentName=${script(this.options.agentName)};`;
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
  /** `/` on the server for someone who may see more than one artifact: a page of links. */
  sendList(response, sites) {
    const noun = this.options.noun.en;
    this.sendPage(response, 200, `Open ${noun}s`, `<h1>Open ${esc(noun)}s</h1><ul>${sites.map((site) => `<li><a href="${esc(site.page)}">${esc(site.title)}</a></li>`).join("")}</ul>`);
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
    if (!this.network.addresses().includes(from)) return "";
    const url = `http://127.0.0.1:${this.port}${this.page}`;
    return `<p class="note">${esc(t.ownerHere)} <a href="${esc(url)}">${esc(url)}</a></p>`;
  }
  /** GET /s/<token>: the name form (or straight in, for a guest already in through this link); POST: join. */
  async join(request, response, method, token2) {
    const t = this.words(request);
    const role = this.sharing.linkRole(token2);
    const local = this.isLocal(request);
    const form = method === "POST" ? await readBody(request, 8 << 10).then((body) => body.toString("utf8"), () => "") : "";
    const title = this.options.title();
    if (!role || !local && !this.on) return this.sendPage(response, 404, t.linkGoneTitle, `<h1>${esc(t.linkGoneTitle)}</h1><p>${esc(t.linkGone)}</p>`);
    if (local) {
      const lan = this.on ? this.network.addresses()[0] : void 0;
      const there = lan ? `http://${lan}:${this.port}${this.page}s/${token2}` : "";
      const tryIt = there ? `<p>${esc(t.tryRole(t.roles[role]))} <a href="${esc(there)}">${esc(there)}</a></p>` : "";
      return this.sendPage(response, 200, title, `<h1>${esc(title)}</h1><p>${esc(t.youOwn)} <a href="${esc(this.page)}">${esc(t.openAsOwner)}</a></p>${tryIt}`);
    }
    const current = this.sharing.guest(this.cookie(request));
    if (method === "GET" && current && current.link === this.sharing.state.links[role].token) {
      response.writeHead(303, { Location: this.page, "Cache-Control": "no-store" }).end();
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
    response.writeHead(303, { Location: this.page, "Set-Cookie": cookie, "Cache-Control": "no-store" }).end();
  }
  /**
   * The links this person may pass on: their own role's and the ones below it that are on (the owner: every one on), at
   * the address they came by (`host`, a Host header the hub let in). A guest could forward the link they joined
   * with anyway; a lower one gives no more than that. Who joins through one shows in the owner's panel like anyone else.
   */
  invites(viewer, host) {
    const { links } = this.sharing.state;
    const from = viewer.role === "owner" ? 0 : GUEST_ROLES.indexOf(viewer.role);
    return { links: GUEST_ROLES.slice(from).filter((role) => links[role].on).map((role) => ({ role, url: `http://${host}${this.page}s/${links[role].token}` })) };
  }
  /** Links, addresses and people, for the share panel and `artifact.mjs share`. */
  shareView() {
    const addresses = (this.on ? this.network.addresses() : []).sort((a, b) => Number(isTailnet(a)) - Number(isTailnet(b)));
    const local = addresses.filter((a) => !isTailnet(a));
    const base2 = local.length ? `http://${local[0]}:${this.port}` : addresses.length ? `http://${addresses[0]}:${this.port}` : `http://127.0.0.1:${this.port}`;
    const tailnet = addresses.find(isTailnet);
    const online = /* @__PURE__ */ new Set();
    for (const live of this.live) if (live.viewer.guest) online.add(live.viewer.guest.id);
    const { links, guests } = this.sharing.state;
    const lan = addresses.length ? addresses : [...lanAddresses()].sort((a, b) => Number(isTailnet(a)) - Number(isTailnet(b)));
    const network = lan.length ? `http://${lan[0]}:${this.port}` : base2;
    return {
      title: this.options.title(),
      lan: this.on,
      port: this.port,
      page: this.page,
      addresses,
      local: `http://127.0.0.1:${this.port}${this.page}`,
      links: Object.fromEntries(GUEST_ROLES.map((role) => [role, { on: links[role].on, url: `${base2}${this.page}s/${links[role].token}`, networkUrl: `${network}${this.page}s/${links[role].token}` }])),
      ...tailnet ? { tailnet: { address: tailnet, links: Object.fromEntries(GUEST_ROLES.map((role) => [role, { on: links[role].on, url: `http://${tailnet}:${this.port}${this.page}s/${links[role].token}` }])) } } : {},
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
var ROOT_SHIM = `
var P=location.protocol==='https:'?'wss:':'ws:';
function under(u){try{var a=new URL(String(u),location.href);if(a.host===location.host&&/^(https?|wss?):$/.test(a.protocol)&&a.pathname.indexOf(BASE)!==0)a.pathname=BASE+a.pathname.slice(1);return a.href}catch(e){return u}}
var F=window.fetch;
window.fetch=function(i,o){if(typeof Request==='function'&&i instanceof Request){var r=under(i.url);return F.call(this,r===i.url?i:new Request(r,i),o)}return F.call(this,under(i&&i.href||i),o)};
var X=XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open=function(m,u){var a=[].slice.call(arguments);a[1]=under(u);return X.apply(this,a)};
var W=window.WebSocket;
function WS(u,p){return p===undefined?new W(under(u)):new W(under(u),p)}
WS.prototype=W.prototype;WS.CONNECTING=0;WS.OPEN=1;WS.CLOSING=2;WS.CLOSED=3;
window.WebSocket=WS;
if(navigator.sendBeacon){var B=navigator.sendBeacon;navigator.sendBeacon=function(u,d){return B.call(navigator,under(u),d)}}
class S extends EventTarget{
constructor(u){super();this.url=under(u);this.withCredentials=false;this.readyState=0;this.onopen=this.onmessage=this.onerror=null;this.l='';this.c()}
c(){var t=this,a=new URL(t.url);a.protocol=P;if(t.l)a.searchParams.set('__lastEventId',t.l);var w=t.w=new W(a.href,'baoyu-sse'),b='';
w.onopen=function(){t.readyState=1;t.f(new Event('open'))};
w.onmessage=function(e){b+=e.data;var i;while((i=b.indexOf('\\n\\n'))>=0){t.b(b.slice(0,i));b=b.slice(i+2)}};
w.onclose=function(e){if(t.readyState===2)return;if(e.code>=4000){t.readyState=2;t.f(new Event('error'));return}t.readyState=0;t.f(new Event('error'));t.r=setTimeout(function(){t.c()},1000)}}
b(s){var n='message',d=[],h=false;s.split('\\n').forEach(function(x){if(!x||x[0]===':')return;var i=x.indexOf(':'),k=i<0?x:x.slice(0,i),v=i<0?'':x.slice(i+1).replace(/^ /,'');if(k==='event')n=v;else if(k==='data'){d.push(v);h=true}else if(k==='id')this.l=v}.bind(this));if(h)this.f(new MessageEvent(n,{data:d.join('\\n'),origin:location.origin,lastEventId:this.l}))}
f(e){this.dispatchEvent(e);var h=this['on'+e.type];if(typeof h==='function')h.call(this,e)}
close(){this.readyState=2;clearTimeout(this.r);if(this.w)this.w.close()}
}
S.CONNECTING=0;S.OPEN=1;S.CLOSED=2;
window.EventSource=S;
`;
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

var MAX_EDIT = 2e3;
function editScript(a, b) {
  const n = a.length;
  const m = b.length;
  const limit = Math.min(n + m, MAX_EDIT);
  const offset = limit + 1;
  const v = new Int32Array(2 * limit + 3);
  const trace = [];
  let found = -1;
  for (let d = 0; d <= limit; d++) {
    trace.push(v.slice(offset - d - 1, offset + d + 2));
    for (let k = -d; k <= d; k += 2) {
      let x2 = k === -d || k !== d && v[offset + k - 1] < v[offset + k + 1] ? v[offset + k + 1] : v[offset + k - 1] + 1;
      let y2 = x2 - k;
      while (x2 < n && y2 < m && a[x2] === b[y2]) {
        x2++;
        y2++;
      }
      v[offset + k] = x2;
      if (x2 >= n && y2 >= m) {
        found = d;
        break;
      }
    }
    if (found >= 0) break;
  }
  if (found < 0) return null;
  const ops = [];
  let x = n;
  let y = m;
  for (let d = found; d > 0; d--) {
    const prev = trace[d];
    const at = (k2) => prev[k2 + d + 1];
    const k = x - y;
    const prevK = k === -d || k !== d && at(k - 1) < at(k + 1) ? k + 1 : k - 1;
    const prevX = at(prevK);
    const prevY = prevX - prevK;
    while (x > prevX && y > prevY) {
      ops.push("=");
      x--;
      y--;
    }
    ops.push(x === prevX ? "+" : "-");
    x = prevX;
    y = prevY;
  }
  while (x > 0 && y > 0) {
    ops.push("=");
    x--;
    y--;
  }
  return ops.reverse();
}
function hunksOf(base2, side, mine) {
  const ops = editScript(base2, side);
  if (!ops) return null;
  const out = [];
  let open2 = null;
  let i = 0;
  let j = 0;
  for (const op of ops) {
    if (op === "=") {
      open2 = null;
      i++;
      j++;
      continue;
    }
    if (!open2) out.push(open2 = { start: i, end: i, lines: [], mine });
    if (op === "-") open2.end = ++i;
    else open2.lines.push(side[j++]);
  }
  return out.flatMap(
    (h) => h.end - h.start > 1 && h.lines.length === h.end - h.start ? h.lines.flatMap((line, k) => {
      const at = h.start + k;
      return line === base2[at] ? [] : [{ start: at, end: at + 1, lines: [line], mine }];
    }) : [h]
  );
}
function applyHunks(base2, start, end, hunks) {
  const out = [];
  let at = start;
  for (const h of hunks) {
    out.push(...base2.slice(at, h.start), ...h.lines);
    at = h.end;
  }
  out.push(...base2.slice(at, end));
  return out;
}
function mergeText(base2, mine, current, at, conflicts) {
  const lines = base2.split("\n");
  const ours = hunksOf(lines, mine.split("\n"), true);
  const theirs = ours && hunksOf(lines, current.split("\n"), false);
  if (!ours || !theirs) return null;
  const all = [...ours, ...theirs].sort((x, y) => x.start - y.start || x.end - y.end);
  const out = [];
  const lost = [];
  let done = 0;
  for (let i = 0; i < all.length; ) {
    const region = [all[i++]];
    const start = region[0].start;
    let end = region[0].end;
    for (; i < all.length; i++) {
      const h = all[i];
      if (!(h.start < end || h.start === h.end && start === end && h.start === start)) break;
      region.push(h);
      end = Math.max(end, h.end);
    }
    out.push(...lines.slice(done, start));
    const mineLines = applyHunks(lines, start, end, region.filter((h) => h.mine));
    if (region.every((h) => h.mine === region[0].mine)) out.push(...applyHunks(lines, start, end, region));
    else {
      const theirLines = applyHunks(lines, start, end, region.filter((h) => !h.mine));
      if (mineLines.join("\n") !== theirLines.join("\n")) lost.push(`${at}@${start + 1}`);
      out.push(...mineLines);
    }
    done = end;
  }
  out.push(...lines.slice(done));
  conflicts.push(...lost);
  return out.join("\n");
}

var isObject = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
var canon = (v) => {
  if (v === void 0) return void 0;
  if (Array.isArray(v)) return `[${v.map((x) => canon(x) ?? "null").join(",")}]`;
  if (isObject(v)) {
    return `{${Object.keys(v).filter((k) => v[k] !== void 0).sort().map((k) => `${JSON.stringify(k)}:${canon(v[k])}`).join(",")}}`;
  }
  return JSON.stringify(v);
};
var same = (a, b) => canon(a) === canon(b);
var byId = (v) => {
  if (!Array.isArray(v)) return null;
  const out = /* @__PURE__ */ new Map();
  for (const item of v) {
    if (!isObject(item) || typeof item.id !== "string" || out.has(item.id)) return null;
    out.set(item.id, item);
  }
  return out;
};
var parseJson = (text) => {
  if (typeof text !== "string") return null;
  try {
    return { value: JSON.parse(text) };
  } catch {
    return null;
  }
};
var layoutLike = (value, like) => {
  if (!like.includes("\n")) return JSON.stringify(value);
  const indent = /\n([ \t]+)\S/.exec(like)?.[1] ?? "  ";
  return JSON.stringify(value, null, indent) + (like.endsWith("\n") ? "\n" : "");
};
function mergeDoc(base2, mine, current) {
  if (current === null) return { result: mine, conflicts: [] };
  const conflicts = [];
  const result = mergeValue(base2, mine, current, "", conflicts);
  return { result: isObject(result) ? result : mine, conflicts };
}
function mergeWrite(base2, mine, current) {
  if (mine === null) return { result: null, conflicts: current === null || same(current, base2) ? [] : ["."] };
  if (current === null) return same(mine, base2) ? { result: null, conflicts: [] } : { result: mine, conflicts: ["."] };
  return mergeDoc(base2, mine, current);
}
function mergeValue(base2, mine, current, at, conflicts) {
  if (same(mine, base2)) return current;
  if (same(current, base2) || same(mine, current)) return mine;
  if (isObject(base2) && isObject(mine) && isObject(current)) return mergeObject(base2, mine, current, at, conflicts);
  const b = byId(base2);
  const m = byId(mine);
  const c = byId(current);
  if (b && m && c) return mergeList(b, m, c, mine, current, at, conflicts);
  if (typeof base2 === "string" && typeof mine === "string" && typeof current === "string") {
    const text = mergeText(base2, mine, current, at || ".", conflicts);
    if (text !== null) return text;
  }
  conflicts.push(at || ".");
  return mine;
}
function mergeObject(base2, mine, current, at, conflicts) {
  const out = {};
  const keys = [.../* @__PURE__ */ new Set([...Object.keys(mine), ...Object.keys(current), ...Object.keys(base2)])];
  const jsonText2 = mine.kind === "json" && current.kind === "json" && base2.kind === "json";
  for (const k of keys) {
    if (k === "__proto__") continue;
    const where = at ? `${at}.${k}` : k;
    let v;
    const texts = jsonText2 && k === "text" ? [parseJson(base2.text), parseJson(mine.text), parseJson(current.text)] : null;
    if (texts && texts[0] && texts[1] && texts[2] && !same(mine.text, base2.text) && !same(current.text, base2.text)) {
      const merged = mergeValue(texts[0].value, texts[1].value, texts[2].value, where, conflicts);
      v = same(merged, texts[1].value) ? mine.text : same(merged, texts[2].value) ? current.text : layoutLike(merged, mine.text);
    } else {
      v = mergeValue(base2[k], mine[k], current[k], where, conflicts);
    }
    if (v !== void 0) out[k] = v;
  }
  return out;
}
function mergeList(base2, mine, current, mineList, currentList, at, conflicts) {
  const merged = /* @__PURE__ */ new Map();
  for (const id of /* @__PURE__ */ new Set([...mine.keys(), ...current.keys(), ...base2.keys()])) {
    const v = mergeValue(base2.get(id), mine.get(id), current.get(id), `${at}[${id}]`, conflicts);
    if (v !== void 0) merged.set(id, v);
  }
  const order = mineList.map((item) => item.id).filter((id) => merged.has(id));
  currentList.forEach((item, i) => {
    const id = item.id;
    if (!merged.has(id) || order.includes(id)) return;
    let after = -1;
    for (let j = i - 1; j >= 0 && after < 0; j--) after = order.indexOf(currentList[j].id);
    order.splice(after + 1, 0, id);
  });
  return order.map((id) => merged.get(id));
}
var utf8 = new TextDecoder("utf-8", { fatal: true });

import { createHash as createHash4, randomBytes } from "node:crypto";
import fs7 from "node:fs";
import path7 from "node:path";
var HISTORY_DIR = "history";
var INDEX = "index.json";
var OBJECTS = "objects";
var IDLE_MS = 3e4;
var SPAN_MS = 5 * 6e4;
var MAX_VERSIONS = 500;
var MAX_NOTICES = 50;
var NOTICE_DAYS = 7;
var AGENT = { by: "agent", user: { id: "agent", name: "Agent" } };
var SYSTEM = { by: "system", user: { id: "system", name: "" } };
var sha256 = (bytes) => createHash4("sha256").update(bytes).digest("hex");
var SHA = /^[0-9a-f]{64}$/;
var isRecord3 = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
function writeAtomic(file, data) {
  fs7.mkdirSync(path7.dirname(file), { recursive: true });
  const tmp = path7.join(path7.dirname(file), `.${path7.basename(file)}.${process.pid}.${randomBytes(4).toString("hex")}.tmp`);
  try {
    fs7.writeFileSync(tmp, data);
    fs7.renameSync(tmp, file);
  } catch (error) {
    fs7.rmSync(tmp, { force: true });
    throw error;
  }
}
var emptyIndex = () => ({ format: 1, next: 1, base: {}, versions: [], notices: [] });
function readUser(value) {
  return isRecord3(value) && typeof value.id === "string" && typeof value.name === "string" ? { id: value.id, name: value.name } : null;
}
var isAuthor = (value) => value === "human" || value === "agent" || value === "system";
function parseIndex(raw) {
  const index = emptyIndex();
  if (!isRecord3(raw)) return index;
  if (isRecord3(raw.base)) {
    for (const [p, s] of Object.entries(raw.base)) if (typeof s === "string" && SHA.test(s)) index.base[p] = s;
  }
  if (Array.isArray(raw.versions)) {
    for (const v of raw.versions) {
      if (!isRecord3(v) || typeof v.n !== "number" || !isAuthor(v.by) || typeof v.at !== "string" || !isRecord3(v.changes)) continue;
      const user = readUser(v.user);
      if (!user) continue;
      const changes = {};
      for (const [p, s] of Object.entries(v.changes)) if (s === null || typeof s === "string" && SHA.test(s)) changes[p] = s;
      const version = { n: v.n, first: typeof v.first === "string" ? v.first : v.at, at: v.at, by: v.by, user, changes };
      if (typeof v.role === "string") version.role = v.role;
      if (typeof v.restoredFrom === "number") version.restoredFrom = v.restoredFrom;
      if (version.restoredFrom !== void 0 && v.restoredPart === true) version.restoredPart = true;
      if (Array.isArray(v.overwrote)) {
        const list = [];
        for (const o of v.overwrote) {
          const who = isRecord3(o) ? readUser(o.user) : null;
          if (!isRecord3(o) || !who || typeof o.path !== "string" || o.lost !== null && typeof o.lost !== "string" || typeof o.n !== "number" || !isAuthor(o.by)) continue;
          list.push({
            path: o.path,
            lost: o.lost,
            n: o.n,
            by: o.by,
            user: who,
            ...o.soft === true ? { soft: true } : {},
            ...o.chosen === true ? { chosen: true } : {},
            ...typeof o.base === "string" && SHA.test(o.base) ? { base: o.base } : {}
          });
        }
        if (list.length) version.overwrote = list;
      }
      index.versions.push(version);
    }
  }
  index.versions.sort((a, b) => a.n - b.n);
  const last = index.versions.at(-1);
  index.next = Math.max(typeof raw.next === "number" ? raw.next : 1, (last?.n ?? 0) + 1);
  if (Array.isArray(raw.notices)) {
    for (const n of raw.notices) {
      if (!isRecord3(n) || typeof n.id !== "string" || typeof n.to !== "string" || typeof n.path !== "string" || typeof n.n !== "number") continue;
      if (n.kind !== "overwritten" && n.kind !== "overwrote") continue;
      const by = readUser(n.by);
      const lost = isRecord3(n.lost) ? n.lost : null;
      const lostUser = lost ? readUser(lost.user) : null;
      if (!by || !lost || !lostUser || lost.sha !== null && typeof lost.sha !== "string" || typeof lost.n !== "number" || !isAuthor(lost.by)) continue;
      index.notices.push({
        id: n.id,
        to: n.to,
        at: typeof n.at === "string" ? n.at : (/* @__PURE__ */ new Date(0)).toISOString(),
        kind: n.kind,
        path: n.path,
        n: n.n,
        by,
        byAuthor: isAuthor(n.byAuthor) ? n.byAuthor : "human",
        lost: { sha: lost.sha, n: lost.n, by: lost.by, user: lostUser },
        ...n.soft === true ? { soft: true } : {},
        ...typeof n.base === "string" && SHA.test(n.base) ? { base: n.base } : {}
      });
    }
  }
  return index;
}
var History = class {
  dir;
  index;
  /** path → sha: what the files hold after the newest version. */
  headState;
  constructor(root) {
    this.dir = path7.join(root, HISTORY_DIR);
    let raw = null;
    try {
      raw = JSON.parse(fs7.readFileSync(path7.join(this.dir, INDEX), "utf8"));
    } catch {
    }
    this.index = parseIndex(raw);
    this.headState = this.fold(Infinity);
    this.index.notices = this.index.notices.filter((n) => (this.headState.get(n.path) ?? null) !== n.lost.sha);
  }
  get empty() {
    return this.index.versions.length === 0 && Object.keys(this.index.base).length === 0;
  }
  /** What the files hold now, as far as the history knows (path → sha). */
  head() {
    return this.headState;
  }
  versions() {
    return this.index.versions;
  }
  version(n) {
    return this.index.versions.find((v) => v.n === n);
  }
  /** The files after the versions numbered up to `upto` (the base and every version at or below it). */
  fold(upto) {
    const state = new Map(Object.entries(this.index.base));
    for (const version of this.index.versions) {
      if (version.n > upto) break;
      for (const [p, s] of Object.entries(version.changes)) {
        if (s === null) state.delete(p);
        else state.set(p, s);
      }
    }
    return state;
  }
  /** The files right after version `n`; null when it is not kept. */
  stateAt(n) {
    return this.version(n) ? this.fold(n) : null;
  }
  /** The files right before version `n`. */
  stateBefore(n) {
    return this.fold(n - 1);
  }
  /** The content with this sha, from the objects. */
  read(sha) {
    if (!SHA.test(sha)) return null;
    try {
      return fs7.readFileSync(path7.join(this.dir, OBJECTS, sha));
    } catch {
      return null;
    }
  }
  /** Keeps a content that no version holds (an overwrite's `base`); its sha. */
  put(bytes) {
    const sha = sha256(bytes);
    this.putObject(sha, bytes);
    return sha;
  }
  size(sha) {
    if (!SHA.test(sha)) return null;
    try {
      return fs7.statSync(path7.join(this.dir, OBJECTS, sha)).size;
    } catch {
      return null;
    }
  }
  /** The newest version that changed `path`, with what it left there. */
  lastChange(p) {
    for (let i = this.index.versions.length - 1; i >= 0; i--) {
      const version = this.index.versions[i];
      if (p in version.changes) return { version, sha: version.changes[p] };
    }
    return null;
  }
  /**
   * Records changes: path → its content now (null: deleted). Those equal to the head are left out; nothing left, no
   * version (null). The rest join the open version of the same person, or start a new one.
   */
  record(changes, who, extra = {}, now = /* @__PURE__ */ new Date()) {
    const changed = {};
    for (const [p, bytes] of changes) {
      const sha = bytes === null ? null : sha256(bytes);
      if ((this.headState.get(p) ?? null) === sha) continue;
      if (bytes !== null && sha !== null) this.putObject(sha, bytes);
      changed[p] = sha;
    }
    if (Object.keys(changed).length === 0) return null;
    const iso = now.toISOString();
    const last = this.index.versions.at(-1);
    const joins = !!last && who.by !== "system" && last.by === who.by && last.user.id === who.user.id && last.restoredFrom === void 0 && extra.restoredFrom === void 0 && now.getTime() - Date.parse(last.at) < IDLE_MS && now.getTime() - Date.parse(last.first) < SPAN_MS;
    let version;
    if (joins) {
      version = last;
      version.at = iso;
      Object.assign(version.changes, changed);
      if (who.user.name) version.user = { ...who.user };
    } else {
      version = { n: this.index.next++, first: iso, at: iso, by: who.by, user: { ...who.user }, changes: changed };
      if (who.role) version.role = who.role;
      if (extra.restoredFrom !== void 0) version.restoredFrom = extra.restoredFrom;
      if (extra.restoredFrom !== void 0 && extra.restoredPart) version.restoredPart = true;
      this.index.versions.push(version);
    }
    for (const [p, s] of Object.entries(changed)) {
      if (s === null) this.headState.delete(p);
      else this.headState.set(p, s);
    }
    this.index.notices = this.index.notices.filter(
      (n) => !(n.path in changed && (changed[n.path] === n.lost.sha || extra.restoredFrom !== void 0 && n.to === who.user.id))
    );
    if (extra.overwrote?.length) {
      version.overwrote = [...(version.overwrote ?? []).filter((o) => !extra.overwrote.some((x) => x.path === o.path)), ...extra.overwrote];
      this.notify(version, who, extra.overwrote, now);
    }
    this.prune(now);
    this.save();
    return version;
  }
  /** Notices for an overwrite: to whoever lost their change (the agent's go to the owner), and a hard one's saver unless they chose it. */
  notify(version, who, overwrote, now) {
    const at = now.toISOString();
    for (const o of overwrote) {
      const lost = { sha: o.lost, n: o.n, by: o.by, user: o.user };
      const victim = o.by === "agent" ? "local" : o.user.id;
      const fields = {
        at,
        path: o.path,
        n: version.n,
        by: { ...who.user },
        byAuthor: who.by,
        lost,
        ...o.soft ? { soft: true } : {},
        ...o.base ? { base: o.base } : {}
      };
      const same3 = (n) => n.path === o.path && n.n === version.n;
      this.index.notices = this.index.notices.filter((n) => !same3(n));
      if (victim !== who.user.id) this.index.notices.push({ id: randomBytes(6).toString("hex"), to: victim, kind: "overwritten", ...fields });
      if (!o.soft && !o.chosen) this.index.notices.push({ id: randomBytes(6).toString("hex"), to: who.user.id, kind: "overwrote", ...fields });
    }
  }
  /** The notices for this person, newest first. */
  noticesFor(userId) {
    return this.index.notices.filter((n) => n.to === userId).reverse();
  }
  notice(id) {
    return this.index.notices.find((n) => n.id === id);
  }
  /** Dismisses one of this person's notices; false when they have none by that id. */
  dismiss(userId, id) {
    const before = this.index.notices.length;
    this.index.notices = this.index.notices.filter((n) => !(n.id === id && n.to === userId));
    if (this.index.notices.length === before) return false;
    this.save();
    return true;
  }
  /**
   * What to write to bring version `n` back: path → content (null: delete), for `paths` (default: every file it or the
   * head holds), only where the head differs. null when the version is not kept or a content is missing.
   */
  restoreTo(n, paths, tracked = () => true) {
    const target = this.stateAt(n);
    if (!target) return null;
    const out = /* @__PURE__ */ new Map();
    const all = paths ?? [.../* @__PURE__ */ new Set([...target.keys(), ...this.headState.keys()])];
    for (const p of all) {
      if (!tracked(p)) continue;
      const want = target.get(p) ?? null;
      if ((this.headState.get(p) ?? null) === want) continue;
      if (want === null) {
        out.set(p, null);
        continue;
      }
      const bytes = this.read(want);
      if (!bytes) return null;
      out.set(p, bytes);
    }
    return out;
  }
  /** Each version's changes as added, edited or deleted (what the file held before it decides). */
  fileChanges() {
    const out = /* @__PURE__ */ new Map();
    const state = new Map(Object.entries(this.index.base));
    for (const version of this.index.versions) {
      const list = [];
      for (const [p, s] of Object.entries(version.changes)) {
        const had = state.has(p);
        list.push({ path: p, op: s === null ? "deleted" : had ? "edited" : "added" });
        if (s === null) state.delete(p);
        else state.set(p, s);
      }
      out.set(version.n, list);
    }
    return out;
  }
  putObject(sha, bytes) {
    const file = path7.join(this.dir, OBJECTS, sha);
    if (fs7.existsSync(file)) return;
    writeAtomic(file, bytes);
  }
  /** Past MAX_VERSIONS the oldest fold into the base; old notices go; contents no one holds are removed. */
  prune(now) {
    let folded = false;
    while (this.index.versions.length > MAX_VERSIONS) {
      const old = this.index.versions.shift();
      for (const [p, s] of Object.entries(old.changes)) {
        if (s === null) delete this.index.base[p];
        else this.index.base[p] = s;
      }
      folded = true;
    }
    const oldest = now.getTime() - NOTICE_DAYS * 864e5;
    const kept = this.index.versions[0]?.n ?? Infinity;
    const perPerson = /* @__PURE__ */ new Map();
    this.index.notices = this.index.notices.filter((n) => Date.parse(n.at) >= oldest && n.lost.n >= kept).reverse().filter((n) => {
      const count = (perPerson.get(n.to) ?? 0) + 1;
      perPerson.set(n.to, count);
      return count <= MAX_NOTICES;
    }).reverse();
    if (folded) this.collect();
  }
  /** Removes the objects that neither the base, a version nor a notice holds (with the base an overwrite was made on). */
  collect() {
    const keep = new Set(Object.values(this.index.base));
    for (const version of this.index.versions) {
      for (const s of Object.values(version.changes)) if (s) keep.add(s);
      for (const o of version.overwrote ?? []) if (o.base) keep.add(o.base);
    }
    for (const notice of this.index.notices) {
      if (notice.lost.sha) keep.add(notice.lost.sha);
      if (notice.base) keep.add(notice.base);
    }
    let names;
    try {
      names = fs7.readdirSync(path7.join(this.dir, OBJECTS));
    } catch {
      return;
    }
    for (const name of names) if (SHA.test(name) && !keep.has(name)) fs7.rmSync(path7.join(this.dir, OBJECTS, name), { force: true });
  }
  save() {
    writeAtomic(path7.join(this.dir, INDEX), `${JSON.stringify(this.index)}
`);
  }
};
var MAX_DIFF_BYTES = 1024 * 1024;
var CONTEXT = 3;
var MAX_DIFF_LINES = 3e3;
var MAX_LINE = 2e3;
var decoder = new TextDecoder("utf-8", { fatal: true });
function textOf(bytes) {
  if (bytes === null) return null;
  if (bytes.includes(0)) return void 0;
  try {
    return decoder.decode(bytes);
  } catch {
    return void 0;
  }
}
var splitLines = (text) => text === null || text === "" ? [] : text.replace(/\r\n?/g, "\n").replace(/\n$/, "").split("\n");
function diffContents(before, after) {
  if ((before?.length ?? 0) > MAX_DIFF_BYTES || (after?.length ?? 0) > MAX_DIFF_BYTES) return { tooLarge: true, added: 0, removed: 0, lines: [] };
  const a = textOf(before);
  const b = textOf(after);
  if (a === void 0 || b === void 0) return { binary: true, added: 0, removed: 0, lines: [] };
  const left = splitLines(a);
  const right = splitLines(b);
  let head = 0;
  while (head < left.length && head < right.length && left[head] === right[head]) head++;
  let tail = 0;
  while (tail < left.length - head && tail < right.length - head && left[left.length - 1 - tail] === right[right.length - 1 - tail]) tail++;
  const middle = editScript(left.slice(head, left.length - tail), right.slice(head, right.length - tail));
  if (!middle) return { tooLarge: true, added: 0, removed: 0, lines: [] };
  const ops = [...Array(head).fill("="), ...middle, ...Array(tail).fill("=")];
  const all = [];
  let i = 0;
  let j = 0;
  let added = 0;
  let removed = 0;
  const cut = (s) => s.length > MAX_LINE ? `${s.slice(0, MAX_LINE)}\u2026` : s;
  for (const op of ops) {
    if (op === "=") all.push([" ", cut(right[j++])]), i++;
    else if (op === "-") all.push(["-", cut(left[i++])]), removed++;
    else all.push(["+", cut(right[j++])]), added++;
  }
  const keep = new Uint8Array(all.length);
  all.forEach(([kind], at) => {
    if (kind === " ") return;
    for (let x = Math.max(0, at - CONTEXT); x <= Math.min(all.length - 1, at + CONTEXT); x++) keep[x] = 1;
  });
  const lines = [];
  let skipped = 0;
  let truncated = false;
  for (let at = 0; at < all.length; at++) {
    if (!keep[at]) {
      skipped++;
      continue;
    }
    if (skipped) lines.push(["~", String(skipped)]);
    skipped = 0;
    if (lines.length >= MAX_DIFF_LINES) {
      truncated = true;
      break;
    }
    lines.push(all[at]);
  }
  if (skipped && !truncated) lines.push(["~", String(skipped)]);
  return { added, removed, lines, ...truncated ? { truncated: true } : {} };
}

var whoOf = (viewer) => ({ by: "human", user: { id: viewer.user.id, name: viewer.user.name }, role: viewer.role });
var MAX_BODY = 64 << 10;
var HistoryHost = class {
  history;
  options;
  constructor(options) {
    this.options = options;
    this.history = options.history;
  }
  /** What the page's boot script tells the panel (window.__baoyuHistory); `preview` on a version's preview page. */
  bootGlobal(viewer, preview) {
    const global = { base: this.options.base, canRestore: canEditAs(viewer.role), me: viewer.user.id };
    const version = preview === void 0 ? void 0 : this.history.version(preview);
    if (version) {
      const newest = this.history.versions().at(-1);
      global.preview = { n: version.n, at: version.at, by: version.by, name: version.user.name, current: version === newest, current_url: this.options.base };
    }
    return global;
  }
  notices(viewer, label) {
    const head = this.history.head();
    const gone = (n) => !head.has(n.path) && this.history.version(n.n)?.changes[n.path] === null;
    return this.history.noticesFor(viewer.user.id).map((n) => noticeView(n, label, this.history.version(n.lost.n)?.at, gone(n)));
  }
  list(viewer) {
    const label = this.options.labels();
    const versions = this.history.versions();
    const changes = this.history.fileChanges();
    const newest = versions.at(-1);
    const rows = [...versions].reverse().map((v) => ({
      n: v.n,
      first: v.first,
      at: v.at,
      by: v.by,
      name: v.user.name,
      userId: v.user.id,
      ...v.role ? { role: v.role } : {},
      ...v.restoredFrom !== void 0 ? { restoredFrom: v.restoredFrom } : {},
      ...v.restoredPart ? { restoredPart: true } : {},
      ...v === newest ? { current: true } : {},
      preview: this.options.previewUrl(v.n),
      files: (changes.get(v.n) ?? []).map((c) => ({ path: c.path, op: c.op, label: label(c.path) })),
      ...v.overwrote?.length ? { overwrote: v.overwrote.map((o) => ({ path: o.path, label: label(o.path), name: o.user.name, by: o.by, n: o.n, ...o.soft ? { soft: true } : {} })) } : {}
    }));
    return { me: viewer.user.id, canRestore: canEditAs(viewer.role), rows, notices: this.notices(viewer, label) };
  }
  /** Answers `__history…` (`sub` is what follows it); false for a path it doesn't know. */
  async handle(request, response, sub, viewer) {
    const method = request.method ?? "GET";
    const url = new URL(request.url ?? "/", "http://local");
    if (method === "POST" && !sameOrigin(request)) {
      request.resume();
      sendJson(response, 403, { code: "not_granted", message: "Cross-origin write refused." });
      return true;
    }
    if (method === "GET" && (sub === "" || sub === "/")) return sendJson(response, 200, this.list(viewer)), true;
    if (sub === "/notices") {
      if (method === "GET") return sendJson(response, 200, { notices: this.notices(viewer, this.options.labels()) }), true;
      if (method !== "POST") return sendJson(response, 405, { code: "method_not_allowed", message: "GET or POST" }), true;
      const body = await this.body(request, response);
      if (!body) return true;
      if (typeof body.dismiss !== "string") return sendJson(response, 400, { code: "invalid_argument", message: "Expected {dismiss: id}." }), true;
      this.history.dismiss(viewer.user.id, body.dismiss);
      return sendJson(response, 200, { notices: this.notices(viewer, this.options.labels()) }), true;
    }
    const versionRoute = /^\/(\d+)\/(diff|restore)$/.exec(sub);
    if (versionRoute) {
      const n = Number(versionRoute[1]);
      const version = this.history.version(n);
      if (!version) return sendJson(response, 404, { code: "not_found", message: `There is no version ${n} (it may be too old to keep).` }), true;
      if (versionRoute[2] === "diff") {
        if (method !== "GET") return sendJson(response, 405, { code: "method_not_allowed", message: "GET" }), true;
        const p = url.searchParams.get("path") ?? "";
        if (!(p in version.changes)) return sendJson(response, 404, { code: "not_found", message: `Version ${n} did not change ${p}.` }), true;
        const before = this.history.stateBefore(n).get(p) ?? null;
        const after = version.changes[p] ?? null;
        return sendJson(response, 200, this.diff(p, before, after)), true;
      }
      if (method !== "POST") return sendJson(response, 405, { code: "method_not_allowed", message: "POST" }), true;
      if (!canEditAs(viewer.role)) return sendJson(response, 403, { code: "not_writer", message: "Only the owner and editors can bring a version back." }), true;
      const body = await this.body(request, response);
      if (!body) return true;
      const paths = Array.isArray(body.paths) ? body.paths.filter((p) => typeof p === "string") : void 0;
      const changes = this.history.restoreTo(n, paths, this.options.tracked);
      if (!changes) return sendJson(response, 409, { code: "unavailable", message: `Version ${n} can't be brought back: a file it holds is missing from the history.` }), true;
      const made = await this.options.apply(changes, whoOf(viewer), { restoredFrom: n });
      this.options.log(`history: ${viewer.user.name} brought back version ${n}${paths ? ` (${paths.join(", ")})` : ""}${made ? ` as version ${made.n}` : " (nothing to change)"}`);
      return sendJson(response, 200, { version: made?.n ?? null, changed: [...changes.keys()] }), true;
    }
    const noticeRoute = /^\/notice\/([0-9a-f]{6,32})\/(diff|recover)$/.exec(sub);
    if (noticeRoute) {
      const notice = this.history.notice(noticeRoute[1]);
      if (!notice || notice.to !== viewer.user.id) return sendJson(response, 404, { code: "not_found", message: "No such notice." }), true;
      if (noticeRoute[2] === "diff") {
        if (method !== "GET") return sendJson(response, 405, { code: "method_not_allowed", message: "GET" }), true;
        const now2 = this.history.head().get(notice.path) ?? null;
        const nowBytes = now2 === null ? null : this.history.read(now2);
        const back2 = this.recovered(notice, nowBytes);
        if (now2 && !nowBytes || !back2) return sendJson(response, 200, { path: notice.path, label: this.options.labels()(notice.path), missing: true, added: 0, removed: 0, lines: [], now: now2 }), true;
        return sendJson(response, 200, { ...this.diffBytes(notice.path, nowBytes, back2.bytes), now: now2 }), true;
      }
      if (method !== "POST") return sendJson(response, 405, { code: "method_not_allowed", message: "POST" }), true;
      if (!canEditAs(viewer.role)) return request.resume(), sendJson(response, 403, { code: "not_writer", message: "Only the owner and editors can change the files." }), true;
      const body = await this.body(request, response);
      if (!body) return true;
      const now = this.history.head().get(notice.path) ?? null;
      if ("now" in body && body.now !== now) {
        return sendJson(response, 409, { code: "changed", message: "This changed while you were looking. Compare again." }), true;
      }
      const back = this.recovered(notice, now === null ? null : this.history.read(now));
      if (!back) return sendJson(response, 409, { code: "unavailable", message: "That content is no longer in the history." }), true;
      const made = await this.options.apply(/* @__PURE__ */ new Map([[notice.path, back.bytes]]), whoOf(viewer), { restoredFrom: notice.lost.n, ...back.part ? { restoredPart: true } : {} });
      this.history.dismiss(viewer.user.id, notice.id);
      this.options.log(`history: ${viewer.user.name} brought back ${notice.lost.user.name}'s ${back.bytes === null ? "deletion of " : ""}${notice.path} (version ${notice.lost.n}${back.part ? ", what was replaced" : ""})`);
      return sendJson(response, 200, { version: made?.n ?? null }), true;
    }
    return false;
  }
  /** Before → after of one file, with the versions' names for the panel's header. */
  diff(p, before, after) {
    const read = (sha) => sha === null ? null : this.history.read(sha);
    const a = read(before);
    const b = read(after);
    if (before && !a || after && !b) return { path: p, label: this.options.labels()(p), missing: true, added: 0, removed: 0, lines: [] };
    return this.diffBytes(p, a, b);
  }
  diffBytes(p, a, b) {
    const [x, y] = this.options.diffSides ? this.options.diffSides(p, a, b) : [a, b];
    return { path: p, label: this.options.labels()(p), ...diffContents(x, y) };
  }
  /**
   * What bringing a notice's lost content back writes to its file (`now`: what the file holds): the lost content merged
   * into it when the notice has a base and the server can merge (`part` when that is not the whole lost content), else
   * the whole lost content; a deletion deletes it again (bytes null). null: not in the history.
   */
  recovered(notice, now) {
    if (notice.lost.sha === null) return { bytes: null, part: false };
    const lost = this.history.read(notice.lost.sha);
    if (!lost) return null;
    const base2 = notice.base ? this.history.read(notice.base) : null;
    const merged = base2 && this.options.recover ? this.options.recover(notice.path, base2, lost, now) : null;
    return merged ? { bytes: merged, part: !merged.equals(lost) } : { bytes: lost, part: false };
  }
  async body(request, response) {
    try {
      const raw = (await readBody(request, MAX_BODY)).toString("utf8");
      const body = raw.trim() ? JSON.parse(raw) : {};
      if (typeof body === "object" && body !== null && !Array.isArray(body)) return body;
    } catch {
    }
    sendJson(response, 400, { code: "invalid_argument", message: "Expected a JSON object." });
    return null;
  }
};
function noticeView(n, label, lostAt, gone) {
  return {
    ...lostAt ? { lostAt } : {},
    id: n.id,
    kind: n.kind,
    at: n.at,
    path: n.path,
    label: label(n.path),
    n: n.n,
    name: n.by.name,
    by: n.byAuthor,
    lostName: n.lost.user.name,
    lostBy: n.lost.by,
    lostN: n.lost.n,
    ...n.soft ? { soft: true } : {},
    // Bringing it back puts back only what was replaced (a write with a base); into a deleted file, all of it.
    ...n.base && !gone ? { part: true } : {},
    ...gone ? { removed: true } : {},
    // What was replaced is a deletion: bringing it back deletes the file again.
    ...n.lost.sha === null ? { deleted: true } : {}
  };
}
var plain = (text) => ({ en: text, zh: text });

var OVERLAP_MS = 6e4;
var docBytes = (data) => Buffer.from(`${JSON.stringify(data, null, 2)}
`);
var parse = (bytes) => {
  if (bytes === null) return null;
  try {
    const value = JSON.parse(bytes.toString("utf8"));
    return typeof value === "object" && value !== null && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
};
var same2 = (a, b) => JSON.stringify(a) === JSON.stringify(b);
var DbHistory = class {
  history;
  host;
  options;
  /**
   * Document → who is writing it from the page, and what the write is (a restore; a merged write: the document it was
   * made on and the values in it that replaced someone else's), until the rescan after it.
   */
  pending;
  /** The first rescan also looks for documents deleted while no server ran. */
  first;
  constructor(options) {
    this.options = options;
    this.history = new History(options.root);
    this.pending = /* @__PURE__ */ new Map();
    this.first = true;
    this.host = new HistoryHost({
      history: this.history,
      labels: () => {
        const named = options.labels();
        return (p) => named(p) ?? plain(p);
      },
      base: options.base,
      previewUrl: (n) => `${options.base}?at=${n}`,
      apply: async (changes, who, extra) => this.apply(changes, who, extra),
      tracked: options.tracked,
      diffSides: textSides,
      recover: (_path, base2, lost, now) => {
        const b = parse(base2);
        const l = parse(lost);
        const n = parse(now);
        if (!b || !l) return null;
        return n ? docBytes(mergeDoc(b, l, n).result) : lost;
      },
      log: options.log
    });
  }
  /**
   * A page's write of `path` by `who`, until `settle`: the rescan in between records it as theirs. `merge`: the write was
   * merged (mergeDoc) from this base, and these are the values in it that replaced someone else's (empty: nothing lost).
   */
  attribute(path19, who, merge) {
    this.pending.set(path19, { who, ...merge ? { merge } : {} });
  }
  /** After the page's write and its rescan (the write may have changed nothing, or failed). */
  settle(path19) {
    this.pending.delete(path19);
  }
  /** Records the rescan's changes; `present` says which documents are on disk now (for the first rescan). */
  record(changes, present) {
    const groups = /* @__PURE__ */ new Map();
    const fallback = this.history.empty ? SYSTEM : AGENT;
    const add = (who, restore, p, bytes, merge) => {
      const key = `${who.by}\0${who.user.id}\0${restore.restoredFrom ?? ""}\0${restore.restoredPart ? "part" : ""}`;
      let group = groups.get(key);
      if (!group) groups.set(key, group = { who, restore, files: /* @__PURE__ */ new Map(), merged: /* @__PURE__ */ new Map() });
      group.files.set(p, bytes);
      if (merge) group.merged.set(p, merge);
    };
    for (const c of changes) {
      if (!this.options.tracked(c.path)) continue;
      const by = this.pending.get(c.path);
      const restore = by?.restoredFrom !== void 0 ? { restoredFrom: by.restoredFrom, ...by.restoredPart ? { restoredPart: true } : {} } : {};
      add(by?.who ?? fallback, restore, c.path, c.data === null ? null : docBytes(c.data), by?.merge);
    }
    if (this.first) {
      this.first = false;
      for (const p of this.history.head().keys()) if (this.options.tracked(p) && !present(p) && !changes.some((c) => c.path === p)) add(fallback, {}, p, null);
    }
    const made = [];
    for (const group of groups.values()) {
      const overwrote = group.who.by !== "system" && group.restore.restoredFrom === void 0 ? this.overlaps(group.files, group.who, group.merged) : [];
      const version = this.history.record(group.files, group.who, { ...group.restore, ...overwrote.length ? { overwrote } : {} });
      if (!version) continue;
      made.push(version);
      if (group.who.by !== "human") {
        const what = group.who.by === "agent" ? "changed outside the page" : "the documents as they were";
        this.options.log(`history: version ${version.n} (${what}): ${[...group.files.keys()].join(", ")}`);
      }
    }
    return made;
  }
  /**
   * Whose values on these documents this change replaced. A merged write says (`merged`: path → its base and the values
   * it replaced; the notice goes to the person behind the document's last version, when that is someone else, and keeps
   * the base so bringing the lost values back leaves the rest; chosen when its person saw that version and saved over
   * it). Otherwise a guess, for a change another person made in
   * the last minute: part of it is gone when merging it (the document before it → theirs) into this one changes this
   * one. The document before it is the notice's base. Their change a deletion: it is gone when the document is back.
   */
  overlaps(files, who, merged) {
    const now = Date.now();
    const out = [];
    for (const [p, bytes] of files) {
      const last = this.history.lastChange(p);
      if (!last) continue;
      const v = last.version;
      if (v.by !== "human" || v.user.id === who.user.id || v.restoredFrom !== void 0) continue;
      if ((this.history.head().get(p) ?? null) !== last.sha) continue;
      const lost = { path: p, lost: last.sha, n: v.n, by: "human", user: { ...v.user }, soft: true };
      const merge = merged.get(p);
      if (merge) {
        if (!merge.conflicts.length) continue;
        const { soft: _soft, ...hard } = lost;
        const over = merge.chosen ? { ...hard, chosen: true } : lost;
        out.push(last.sha === null ? over : { ...over, base: this.history.put(docBytes(merge.base)) });
        continue;
      }
      if (now - Date.parse(v.at) > OVERLAP_MS) continue;
      if (last.sha === null) {
        if (bytes !== null) out.push(lost);
        continue;
      }
      const theirs = parse(this.history.read(last.sha));
      const was = parse(this.history.read(this.history.stateBefore(v.n).get(p) ?? "") ?? null) ?? {};
      const next = parse(bytes) ?? {};
      if (!theirs || same(mergeDoc(was, theirs, next).result, next)) continue;
      out.push({ ...lost, base: this.history.stateBefore(v.n).get(p) ?? this.history.put(docBytes({})) });
    }
    return out;
  }
  /** A restore (or a recovered notice): writes the documents as `who`'s; the rescan after records them. */
  apply(changes, who, extra) {
    const paths = [];
    try {
      for (const [p, bytes] of changes) {
        const data = bytes === null ? null : parse(bytes);
        if (bytes !== null && data === null) continue;
        this.pending.set(p, { who, ...extra.restoredFrom !== void 0 ? { restoredFrom: extra.restoredFrom, ...extra.restoredPart ? { restoredPart: true } : {} } : {} });
        paths.push(p);
        this.options.write(p, data);
      }
      this.options.rescan();
      const versions = this.history.versions();
      const newest = versions.at(-1);
      return newest && newest.user.id === who.user.id && newest.restoredFrom === extra.restoredFrom && paths.some((p) => p in newest.changes) ? newest : null;
    } finally {
      for (const p of paths) this.pending.delete(p);
    }
  }
  /**
   * On a version's page (?at=n): the documents as that version left them in place of the kept ones now, the page's
   * own as they are. null: there is no such version.
   */
  docsAt(n, current) {
    const state = this.history.stateAt(n);
    if (!state) return null;
    const out = /* @__PURE__ */ new Map();
    for (const [p, data] of current) if (!this.options.tracked(p)) out.set(p, data);
    for (const [p, sha] of state) {
      if (!this.options.tracked(p)) continue;
      const data = parse(this.history.read(sha));
      if (data) out.set(p, data);
    }
    return out;
  }
  /** window.__baoyuHistory for this person; `query` is the page's (?at=n on a version's page). */
  bootGlobal(viewer, query) {
    return this.host.bootGlobal(viewer, previewOf(query));
  }
};
function previewOf(query) {
  const at = query.get("at");
  return at !== null && /^\d{1,9}$/.test(at) ? Number(at) : void 0;
}
function textSides(_path, before, after) {
  const a = parse(before);
  const b = parse(after);
  const textOf2 = (d) => d && typeof d.text === "string" ? d.text : null;
  const rest = (d) => {
    if (!d) return null;
    const { text: _text, ...others } = d;
    return others;
  };
  const ta = textOf2(a);
  const tb = textOf2(b);
  if ((ta !== null || a === null) && (tb !== null || b === null) && (a === null || b === null || same2(rest(a), rest(b)))) {
    return [ta === null ? null : Buffer.from(ta), tb === null ? null : Buffer.from(tb)];
  }
  return [before, after];
}

var PEER_ID = /^[A-Za-z0-9_-]{8,64}$/;
function agentWhere(main2, count, label) {
  const where = main2 ? label(main2) : null;
  if (!where || count <= 1) return where;
  return { en: `${where.en} and ${count - 1} more`, zh: `${where.zh} \u7B49 ${count} \u5904` };
}
var AGENT_COLOR = "#d25f25";
var MAX_PEERS = 64;
var MAX_PATCH_BYTES = 16 << 10;
var MAX_FIELDS = 12;
var MAX_PRESENCE_BYTES = 6 << 10;
var BROADCAST_MS = 50;
var LEAVE_GRACE_MS = 4e3;
var AGENT_LINGER_MS = 2e4;
var AGENT_PEER = "agent-claude";
var PresenceHub = class {
  peers = /* @__PURE__ */ new Map();
  listeners = /* @__PURE__ */ new Set();
  agent = null;
  timer = null;
  /** Adds a page's stream; `send` writes one SSE frame to it. Returns what to call when the stream closes. */
  join(peer, viewer, send) {
    let entry = this.peers.get(peer);
    if (entry && entry.viewer.user.id !== viewer.user.id) {
      entry = void 0;
      peer = "";
    }
    if (peer && !entry && this.peers.size < MAX_PEERS) {
      entry = { viewer, presence: {}, updatedAt: Date.now(), streams: 0 };
      this.peers.set(peer, entry);
    }
    if (entry) {
      entry.streams += 1;
      if (entry.leaving) clearTimeout(entry.leaving);
      entry.leaving = void 0;
    }
    this.listeners.add(send);
    send(this.frame());
    this.schedule();
    let open2 = true;
    return () => {
      if (!open2) return;
      open2 = false;
      this.listeners.delete(send);
      if (!entry) return;
      entry.streams -= 1;
      if (entry.streams > 0) return;
      const leaving = entry;
      leaving.leaving = setTimeout(() => {
        if (this.peers.get(peer) === leaving && leaving.streams === 0) {
          this.peers.delete(peer);
          this.schedule();
        }
      }, LEAVE_GRACE_MS);
      leaving.leaving.unref?.();
    };
  }
  /** Merges a page's patch into its presence; false when the peer isn't this person's open page or the patch is bad. */
  update(peer, viewer, patch) {
    const entry = this.peers.get(peer);
    if (!entry || entry.viewer.user.id !== viewer.user.id) return false;
    if (typeof patch !== "object" || patch === null || Array.isArray(patch)) return false;
    const next = { ...entry.presence };
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === void 0) delete next[key];
      else next[key] = value;
    }
    if (Object.keys(next).length > MAX_FIELDS || Buffer.byteLength(JSON.stringify(next)) > MAX_PRESENCE_BYTES) return false;
    entry.presence = next;
    entry.updatedAt = Date.now();
    this.schedule();
    return true;
  }
  /** The agent changed the artifact: it shows on the list (with `context`, where it worked) for a while. */
  agentActive(agent = {}) {
    if (this.agent) clearTimeout(this.agent.timer);
    const presence = { who: { n: agent.name ?? "Agent", c: AGENT_COLOR } };
    if (agent.context) presence.context = agent.context;
    if (agent.where) presence.where = agent.where;
    const timer = setTimeout(() => {
      this.agent = null;
      this.schedule();
    }, AGENT_LINGER_MS);
    timer.unref?.();
    this.agent = { presence, updatedAt: Date.now(), timer };
    this.schedule();
  }
  /** Everyone on the list now. */
  list() {
    const views = [];
    for (const [peer, entry] of this.peers) {
      const who = entry.presence.who;
      const presence = { ...entry.presence, who: { ...typeof who === "object" && who !== null && !Array.isArray(who) ? who : {}, n: entry.viewer.user.name } };
      views.push({ peer, by: entry.viewer.user.id, name: entry.viewer.user.name, role: entry.viewer.role, presence, updatedAt: entry.updatedAt });
    }
    if (this.agent) {
      const name = String(this.agent.presence.who.n ?? "Agent");
      views.push({ peer: AGENT_PEER, by: "agent", name, kind: "agent", presence: this.agent.presence, updatedAt: this.agent.updatedAt });
    }
    return views;
  }
  /** Answers POST `__presence` ({peer, patch}); GET gives the list. */
  async handle(request, response, viewer) {
    const method = request.method ?? "GET";
    if (method === "GET") return sendJson(response, 200, { peers: this.list() });
    if (method !== "POST") {
      request.resume();
      return sendJson(response, 405, { code: "method_not_allowed", message: "GET or POST" });
    }
    if (!sameOrigin(request)) {
      request.resume();
      return sendJson(response, 403, { code: "not_granted", message: "Cross-origin write refused." });
    }
    let body;
    try {
      body = JSON.parse((await readBody(request, MAX_PATCH_BYTES)).toString("utf8"));
    } catch {
      return sendJson(response, 400, { code: "invalid_argument", message: `Expected {peer, patch} under ${MAX_PATCH_BYTES} bytes.` });
    }
    const { peer, patch } = typeof body === "object" && body !== null ? body : {};
    if (typeof peer !== "string" || !PEER_ID.test(peer)) return sendJson(response, 400, { code: "invalid_argument", message: "Expected {peer, patch}." });
    if (!this.update(peer, viewer, patch)) return sendJson(response, 409, { code: "not_joined", message: "That page is not open here (its event stream is closed)." });
    response.writeHead(204, { "Cache-Control": "no-store" }).end();
  }
  /** Ends the timers (the server is closing). */
  close() {
    if (this.timer) clearTimeout(this.timer);
    if (this.agent) clearTimeout(this.agent.timer);
    for (const entry of this.peers.values()) if (entry.leaving) clearTimeout(entry.leaving);
    this.peers.clear();
    this.listeners.clear();
  }
  frame() {
    return `event: peers
data: ${JSON.stringify({ peers: this.list() })}

`;
  }
  schedule() {
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      const frame = this.frame();
      for (const send of this.listeners) send(frame);
    }, BROADCAST_MS);
    this.timer.unref?.();
  }
};

async function shareCall(url, action, fail3) {
  const response = await fetch(new URL("__share", url), action ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(action) } : {});
  const body = await response.json().catch(() => ({}));
  if (!response.ok) fail3("SHARE_REFUSED", String(body.message ?? `the server answered ${response.status}`));
  return body;
}
function rolesOf(flags, key, fail3) {
  const given = flags.get(key);
  if (given === void 0) return [];
  const roles = given === "all" || given === "true" ? [...GUEST_ROLES] : given.split(",").map((r) => r.trim());
  for (const role of roles) if (!isGuestRole(role)) fail3("INVALID_ROLE", `--${key}: editor, commenter, viewer or all (got ${role}).`);
  return roles;
}
function guestRoles(flags, fail3) {
  const given = flags.get("role");
  if (given === void 0) return [];
  return given.split(",").map((pair) => {
    const [guest = "", role = ""] = pair.split("=").map((part) => part.trim());
    if (!guest || !isGuestRole(role)) fail3("INVALID_ROLE", `--role: <guest id>=editor|commenter|viewer, comma separated (got ${pair}).`);
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
  const open2 = !off && changes.length === 0;
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
    if (!open2 && !sharing.state.lan) {
      return {
        lan: false,
        links: Object.fromEntries(GUEST_ROLES.map((role) => [role, sharing.state.links[role].on ? "on" : "off"])),
        message: `Links changed. Not shared on the local network: ${NOT_SHARED_HINT}`
      };
    }
    server = await o.startShared();
    if (!server) o.fail("SERVER_FAILED", `The server did not start. Run ${o.serveCommand} in the foreground to see why.`);
  }
  let view = await shareCall(server.url, null, o.fail);
  for (const change of changes) view = await shareCall(server.url, change, o.fail);
  if (off || open2 && !view.lan) view = await shareCall(server.url, { action: "lan", on: !off }, o.fail);
  const links = view.links;
  const shown2 = (list) => Object.fromEntries(Object.entries(list).map(([role, link]) => [role, link.on ? link.url : "off"]));
  const tailnet = view.lan ? view.tailnet : void 0;
  return {
    lan: view.lan,
    ...view.lan ? { addresses: lanUrls(view) } : {},
    links: shown2(links),
    ...tailnet ? {
      tailscale: shown2(tailnet.links),
      tailscaleNote: `This computer has a Tailscale address (${tailnet.address}): the tailscale links open the same roles for people on your tailnet, from any network. Use the links above for people on this Wi-Fi or LAN.`
    } : {},
    guests: view.guests,
    ...view.lan ? {
      note: "Send the link for the role you want to give: editor edits, commenter comments, viewer reads. Anyone on this network with a link joins under a name they type. The owner (this computer) shares from the Share button too.",
      security: "It is plain http: others on the network can read what passes. A link is the permission: whoever has it gets its role, so send it only to the people meant to have it, and reset a role's link if it went further.",
      stop: o.offCommand
    } : { note: `Not shared on the network: the links work on this computer only. ${NOT_SHARED_HINT}` }
  };
}
var NOT_SHARED_HINT = "share <root> with no options shares it.";
var lanUrls = (view) => (Array.isArray(view.addresses) ? view.addresses : []).map((a) => `http://${String(a)}:${String(view.port)}${String(view.page ?? "/")}`);
async function lanOn(url, flags, fail3) {
  if (!flags.has("lan")) return {};
  return { lan: lanUrls(await shareCall(url, { action: "lan", on: true }, fail3)) };
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
var isRecord4 = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
var isText = (v, max) => typeof v === "string" && v.length <= max;
function cleanText(v) {
  if (typeof v !== "string") return null;
  const text = v.replace(/\r\n?/g, "\n").trim();
  return text !== "" && text.length <= LIMITS.text ? text : null;
}
function readNewThread(body) {
  if (!isRecord4(body)) return null;
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
  if (!isRecord4(body)) return null;
  const text = cleanText(body.text);
  if (text === null) return null;
  if (body.send !== void 0 && typeof body.send !== "boolean") return null;
  return { text, ...body.send ? { send: true } : {} };
}
var readEdit = readReply;
function readStatus(body) {
  return isRecord4(body) && (body.status === "open" || body.status === "resolved") ? body.status : null;
}
function readAgentRequest(body) {
  if (!isRecord4(body)) return null;
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
  if (!isRecord4(data) || data.version !== COMMENTS_VERSION || !Array.isArray(data.threads)) {
    throw new CommentsError("COMMENTS_FILE_INVALID", `not a version ${COMMENTS_VERSION} comments file (expected {"version": 1, "threads": [...]})`, 500);
  }
  const threads = data.threads.filter(
    (t) => isRecord4(t) && typeof t.id === "string" && typeof t.anchor === "string" && typeof t.label === "string" && (t.status === "open" || t.status === "resolved") && Array.isArray(t.messages) && t.messages.every((m) => isRecord4(m) && typeof m.text === "string" && isRecord4(m.author) && (m.author.kind === "user" || m.author.kind === "agent"))
  );
  for (const t of threads) {
    if (!isRecord4(t.location)) t.location = {};
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

import { spawn as spawn2 } from "node:child_process";
import fs9 from "node:fs";
import os5 from "node:os";

import fs8 from "node:fs";
import fsp3 from "node:fs/promises";
import path8 from "node:path";
var LOCK_STALE_MS = 1e4;
var LOCK_WAIT_MS = 5e3;
var LOCK_RETRY_MS = 20;
var commentsPath = (root) => path8.join(root, COMMENTS_FILE);
async function readComments(root) {
  let text;
  try {
    text = await fsp3.readFile(commentsPath(root), "utf8");
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
      const handle = await fsp3.open(file, "wx");
      await handle.writeFile(`${process.pid}
`);
      await handle.close();
      return () => fsp3.rm(file, { force: true });
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
    }
    const info = await fsp3.stat(file).catch(() => null);
    if (info && Date.now() - info.mtimeMs > LOCK_STALE_MS) {
      await fsp3.rm(file, { force: true });
      continue;
    }
    if (Date.now() > deadline) throw new CommentsError("COMMENTS_LOCKED", `${file} is held by another process; try again (or delete it if nothing is running).`, 503);
    await new Promise((resolve) => setTimeout(resolve, LOCK_RETRY_MS));
  }
}
async function writeAtomic2(file, text) {
  const temp = path8.join(path8.dirname(file), `.${path8.basename(file)}.${process.pid}.${Date.now().toString(36)}.tmp`);
  await fsp3.writeFile(temp, text);
  try {
    await fsp3.rename(temp, file);
  } catch (error) {
    await fsp3.rm(temp, { force: true });
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
    const exists = fs8.existsSync(commentsPath(root));
    if (after !== before && (exists || doc.threads.length > 0)) await writeAtomic2(commentsPath(root), after);
    return result;
  } finally {
    await unlock();
  }
}

var AGENT_GRACE_MS = 6e4;
var AGENT_BUSY_MS = 30 * 6e4;
var REQUEST_TTL_MS = 30 * 6e4;
var REQUESTS_KEPT = 32;
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
    return os5.userInfo().username.trim() || "you";
  } catch {
    return "you";
  }
}
function createCommentsService(options) {
  const { root, log: log3, agentHook } = options;
  const userName = (options.userName ?? defaultUserName()).slice(0, 100);
  const owner = { author: { kind: "user", name: userName }, canComment: true, canSend: true, admin: true };
  const viewerOf = options.viewer ?? (() => owner);
  const allowWrite = options.allowWrite ?? (() => true);
  const clients = /* @__PURE__ */ new Map();
  const waiters = [];
  const hookRunning = /* @__PURE__ */ new Set();
  const requests = [];
  const requestFates = /* @__PURE__ */ new Map();
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
    ) || [...requestFates.values()].some((f) => f.state === "working" && at - f.at < AGENT_BUSY_MS);
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
      let base2;
      try {
        base2 = await shared();
      } catch (error) {
        log3(`comments: reading ${COMMENTS_FILE} failed: ${error.message}`);
        return;
      }
      const text = JSON.stringify(base2);
      lastPresence = JSON.stringify(base2.agent);
      if (text === lastSent) return;
      lastSent = text;
      for (const [client, viewer] of clients) client.write(frame({ ...base2, me: meOf(viewer) }));
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
  function setRequestState(id, state) {
    requestFates.delete(id);
    requestFates.set(id, { state, at: Date.now() });
    while (requestFates.size > REQUESTS_KEPT) requestFates.delete(requestFates.keys().next().value);
  }
  function dropStaleRequests() {
    const oldest = Date.now() - REQUEST_TTL_MS;
    while (requests.length > 0 && Date.parse(requests[0].sentAt) < oldest) {
      const dropped = requests.shift();
      setRequestState(dropped.id, "over");
      log3(`comments: dropped request ${dropped.id}: no agent took it in ${REQUEST_TTL_MS / 6e4} minutes`);
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
      for (const request of handed) setRequestState(request.id, "working");
      log3(`comments: sent to the agent (wait): ${[...views, ...handed].map((v) => v.id).join(", ")}`);
      await broadcast();
      return;
    }
    if (agentHook) await runHook(agentHook);
  }
  async function runHook(command2) {
    if (typeof command2 !== "string") return runHandler(command2);
    const doc = await readComments(root);
    for (const thread of pendingForAgent(doc)) {
      if (hookRunning.has(thread.id)) continue;
      hookRunning.add(thread.id);
      const view = agentViews(doc, [thread])[0];
      const child = spawn2(command2, {
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
        log3(`comments: the agent hook failed to start: ${error.message}`);
      });
      child.on("exit", (code) => {
        if (code !== 0) {
          hookRunning.delete(thread.id);
          log3(`comments: the agent hook exited with ${code} for ${thread.id}; the comment stays waiting${stderr ? `: ${stderr.trim()}` : ""}`);
          return;
        }
        void updateComments(root, (d) => {
          const t = d.threads.find((x) => x.id === thread.id);
          if (t) markDelivered(t, now(), "hook");
        }).finally(() => hookRunning.delete(thread.id)).then(() => {
          log3(`comments: sent to the agent (hook): ${thread.id}`);
          return broadcast();
        }).catch((error) => log3(`comments: ${error.message}`));
      });
    }
    for (const request of requests.splice(0)) {
      hookRunning.add(request.id);
      setRequestState(request.id, "working");
      const child = spawn2(command2, {
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
        setRequestState(request.id, "queued");
        log3(`comments: the agent hook ${why} for ${request.id}; the request stays waiting${stderr ? `: ${stderr.trim()}` : ""}`);
      };
      child.on("error", (error) => failed(`failed to start (${error.message})`));
      child.on("exit", (code) => {
        if (code !== 0) return failed(`exited with ${code}`);
        settled = true;
        hookRunning.delete(request.id);
        log3(`comments: sent to the agent (hook): ${request.id}`);
      });
    }
  }
  async function runHandler(handler) {
    for (const { id } of pendingForAgent(await readComments(root))) {
      if (hookRunning.has(id)) continue;
      hookRunning.add(id);
      try {
        const doc = await readComments(root);
        const thread = pendingForAgent(doc).find((t) => t.id === id);
        if (!thread) continue;
        try {
          await handler.thread(agentViews(doc, [thread])[0]);
        } catch (error) {
          log3(`comments: the agent handler failed for ${id}; the comment stays waiting: ${error.message}`);
          continue;
        }
        await updateComments(root, (d) => {
          const t = d.threads.find((x) => x.id === id);
          if (t) markDelivered(t, now(), "hook");
        });
        log3(`comments: sent to the agent (handler): ${id}`);
        await broadcast();
      } finally {
        hookRunning.delete(id);
      }
    }
    const failed = [];
    for (const request of requests.splice(0)) {
      setRequestState(request.id, "working");
      try {
        await handler.request(request);
        log3(`comments: sent to the agent (handler): ${request.id}`);
      } catch (error) {
        failed.push(request);
        setRequestState(request.id, "queued");
        log3(`comments: the agent handler failed for ${request.id}; the request stays waiting: ${error.message}`);
      }
    }
    requests.unshift(...failed);
  }
  let debounce;
  const changed = () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => void broadcast(), WATCH_DEBOUNCE_MS);
  };
  let watcher = null;
  try {
    watcher = fs9.watch(root, (_event, name) => {
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
    fs9.stat(commentsPath(root), (error, info) => {
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
      log3(`comments: could not resolve where a comment points: ${error.message}`);
    }
    const created = await updateComments(root, (doc) => addThread(doc, input, location, viewer.author, now()));
    log3(`comments: ${created.id} added on ${created.label}${location.file ? ` (${location.file})` : ""}${input.send ? ", sent to the agent" : ""}`);
    sendJson2(response, 201, { thread: created });
    await afterChange(Boolean(input.send));
  }
  function enqueue(input) {
    if (!presence().available) throw new CommentsError("AGENT_UNAVAILABLE", "no agent is waiting: copy the request for the chat instead", 409);
    const queued = { id: newId("r"), ...input, sentAt: now() };
    requests.push(queued);
    setRequestState(queued.id, "queued");
    log3(`comments: request ${queued.id}${input.label ? ` (${input.label})` : ""} for the agent`);
    return queued;
  }
  async function ask(request, response) {
    const input = readAgentRequest(await readJson(request));
    if (!input) throw new CommentsError("INVALID_REQUEST", "expected {text} with a non-empty text");
    const queued = enqueue(input);
    sendJson2(response, 202, { request: queued });
    await deliver();
  }
  async function sendRequest(input) {
    const queued = enqueue(input);
    await deliver();
    return queued;
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
    for (const [id, fate] of requestFates) if (fate.state === "working") setRequestState(id, "over");
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
      } else if (parts.length === 2 && parts[0] === "agent" && parts[1] === "send-all") {
        if (method === "POST") {
          request.resume();
          need(viewer.canSend, ONLY_OWNER_SENDS);
          const result = await updateComments(root, (doc) => {
            const open2 = doc.threads.filter((t) => t.status === "open" && t.messages.some((m) => m.author.kind === "user"));
            const sent = open2.filter(canSendToAgent);
            const at = now();
            for (const t of sent) sendToAgent(t, at);
            return { threads: sent, sent: { count: sent.length, open: open2.length } };
          });
          log3(`comments: ${result.sent.count} of ${result.sent.open} open thread(s) sent to the agent`);
          sendJson2(response, 200, result);
          return await afterChange(result.sent.count > 0);
        }
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
          log3(`comments: ${id} ${status === "resolved" ? "resolved" : "reopened"}`);
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
          log3(`comments: ${id} deleted`);
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
          log3(`comments: reply on ${id}${input.send ? ", sent to the agent" : ""}`);
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
          log3(`comments: message edited on ${id}${input.send ? ", sent to the agent" : ""}`);
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
          log3(`comments: ${id} sent to the agent`);
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
  function requestStates() {
    const states = {};
    for (const [id, fate] of requestFates) if (fate.state !== "over") states[id] = fate.state;
    return states;
  }
  return { handle, presence, deliver, sendRequest, requestStates, close };
}

var FILM_MAX_SECONDS = 900;
var FILM_MAX_SCENES = 40;
var FILM_MAX_CHAPTERS = 40;
var NARRATION_MAX_LINE_SECONDS = 90;
var NARRATION_MAX_ASSET_KIB = 4096;
var MUSIC_MAX_BEDS = 4;
var EMBEDDED_LIMIT_DEFINES = {
  __MUSIC_MAX_BEDS__: String(MUSIC_MAX_BEDS),
  __FILM_MAX_SECONDS__: String(FILM_MAX_SECONDS),
  __FILM_MAX_SCENES__: String(FILM_MAX_SCENES),
  __FILM_MAX_CHAPTERS__: String(FILM_MAX_CHAPTERS)
};

import fs10 from "node:fs";
import path9 from "node:path";
var ExplainerError = class extends Error {
};
var lineAt = (src, at) => src.slice(0, at).split("\n").length;
function parseLiteral(src, at = 0) {
  let i = at;
  const fail3 = (what) => {
    throw new ExplainerError(`${what} (line ${lineAt(src, i)})`);
  };
  const space = () => {
    for (; ; ) {
      const c = src[i];
      if (c !== void 0 && /[\s﻿]/.test(c)) i++;
      else if (c === "/" && src[i + 1] === "/") {
        const n = src.indexOf("\n", i);
        i = n < 0 ? src.length : n;
      } else if (c === "/" && src[i + 1] === "*") {
        const n = src.indexOf("*/", i + 2);
        if (n < 0) fail3("a comment that never closes");
        i = n + 2;
      } else return;
    }
  };
  const string = (q) => {
    i++;
    let out = "";
    for (; ; ) {
      if (i >= src.length) fail3("a string that never closes");
      const c = src[i++];
      if (c === q) return out;
      if (q === "`" && c === "$" && src[i] === "{") fail3("a template with ${\u2026} in it");
      if (c === "\\") {
        const e = src[i++] ?? "";
        const hex = (n) => {
          const h = src.slice(i, i + n);
          if (!new RegExp(`^[0-9a-fA-F]{${n}}$`).test(h)) fail3("a bad escape");
          i += n;
          return parseInt(h, 16);
        };
        if (e === "n") out += "\n";
        else if (e === "t") out += "	";
        else if (e === "r") out += "\r";
        else if (e === "b") out += "\b";
        else if (e === "f") out += "\f";
        else if (e === "v") out += "\v";
        else if (e === "0" && !/[0-9]/.test(src[i] ?? "")) out += "\0";
        else if (e === "x") out += String.fromCharCode(hex(2));
        else if (e === "u" && src[i] === "{") {
          const n = src.indexOf("}", i);
          const h = n < 0 ? "" : src.slice(i + 1, n);
          if (!/^[0-9a-fA-F]{1,6}$/.test(h) || parseInt(h, 16) > 1114111) fail3("a bad escape");
          out += String.fromCodePoint(parseInt(h, 16));
          i = n + 1;
        } else if (e === "u") out += String.fromCharCode(hex(4));
        else if (e === "\r") {
          if (src[i] === "\n") i++;
        } else if (e !== "\n" && e !== "\u2028" && e !== "\u2029") out += e;
      } else if ((c === "\n" || c === "\r") && q !== "`") fail3("a line break in a string");
      else out += c;
    }
  };
  const value = () => {
    space();
    const c = src[i];
    if (c === "{") {
      i++;
      const out = {};
      for (; ; ) {
        space();
        if (src[i] === "}") {
          i++;
          return out;
        }
        let key;
        const k = src[i];
        if (k === '"' || k === "'") key = string(k);
        else {
          const m = /^(?:[A-Za-z_$][\w$]*|\d+(?:\.\d+)?)/.exec(src.slice(i, i + 256));
          if (!m) return fail3("a key that is not a name, a string or a number");
          key = m[0];
          i += key.length;
        }
        space();
        if (src[i] !== ":") fail3(`"${key}" without a ":" after it (a method, a shorthand or a spread is code)`);
        i++;
        Object.defineProperty(out, key, { value: value(), enumerable: true, writable: true, configurable: true });
        space();
        if (src[i] === ",") i++;
        else if (src[i] !== "}") fail3('something other than "," or "}" after a value in an object');
      }
    }
    if (c === "[") {
      i++;
      const out = [];
      for (; ; ) {
        space();
        if (src[i] === "]") {
          i++;
          return out;
        }
        out.push(value());
        space();
        if (src[i] === ",") i++;
        else if (src[i] !== "]") fail3('something other than "," or "]" after a value in an array');
      }
    }
    if (c === '"' || c === "'" || c === "`") return string(c);
    const n = /^([+-]?)(0[xX][0-9a-fA-F]+|(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)(?![\w$])/.exec(src.slice(i, i + 64));
    if (n) {
      i += n[0].length;
      return (n[1] === "-" ? -1 : 1) * Number(n[2]);
    }
    for (const [word, v2] of [
      ["true", true],
      ["false", false],
      ["null", null],
      ["undefined", null]
    ]) {
      if (src.startsWith(word, i) && !/[\w$]/.test(src[i + word.length] ?? "")) {
        i += word.length;
        return v2;
      }
    }
    return fail3("code, not data");
  };
  const v = value();
  return { value: v, end: i };
}
function blankComments(src) {
  let out = "";
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === '"' || c === "'" || c === "`") {
      let j = i + 1;
      while (j < src.length && src[j] !== c) j += src[j] === "\\" ? 2 : 1;
      out += src.slice(i, j + 1);
      i = j + 1;
    } else if (c === "/" && src[i + 1] === "/") {
      const n = src.indexOf("\n", i);
      const j = n < 0 ? src.length : n;
      out += " ".repeat(j - i);
      i = j;
    } else if (c === "/" && src[i + 1] === "*") {
      const n = src.indexOf("*/", i + 2);
      const j = n < 0 ? src.length : n + 2;
      out += src.slice(i, j).replace(/[^\n]/g, " ");
      i = j;
    } else {
      out += c;
      i++;
    }
  }
  return out;
}
function literalAssignments(text) {
  const src = blankComments(text);
  const found = [];
  const failed = [];
  const eq = /(?<![=!<>+\-*/%&|^?])=(?![=>])/g;
  for (let m = eq.exec(src); m; m = eq.exec(src)) {
    let j = m.index + 1;
    while (j < src.length && /\s/.test(src[j])) j++;
    if (src[j] !== "{" && src[j] !== "[") continue;
    const start = Math.max(src.lastIndexOf("\n", m.index), src.lastIndexOf(";", m.index)) + 1;
    const target = src.slice(start, m.index).replace(/\s+/g, "");
    try {
      const { value, end } = parseLiteral(src, j);
      found.push({ target, value });
      eq.lastIndex = end;
    } catch (error) {
      failed.push({ target, why: error.message });
    }
  }
  return { found, failed };
}
var DATA_NAMES = ["TIMINGS", "CHAR_TIMES", "FILM", "BRAND", "SEALS"];
function readData(file, into, notes, dir) {
  const { found, failed } = literalAssignments(fs10.readFileSync(file, "utf8"));
  for (const { target, value } of found) {
    const variant = /SCRIPTS\b.*?(?:\.([\w$]+)|\[['"]([\w$-]+)['"]\])$/.exec(target);
    if (variant && (variant[1] ?? variant[2]) !== "SCRIPTS") into.scripts[variant[1] ?? variant[2]] = value;
    else if (/(?:^|[.{(])SCRIPTS$/.test(target) && isRecord5(value)) Object.assign(into.scripts, value);
    else if (/(?:^|[.{(])SCRIPT$/.test(target)) into.scripts[""] = value;
    else for (const name of DATA_NAMES) if (new RegExp(`(?:^|[.{(])${name}$`).test(target)) into.values[name] = value;
  }
  for (const { target, why } of failed) {
    const name = [...DATA_NAMES, "SCRIPTS", "SCRIPT"].find((n) => new RegExp(`\\b${n}\\b`).test(target));
    if (name) notes.push(`${path9.relative(dir, file)}: ${name} is not plain data (${why}), so it is not read here.`);
  }
}
var isRecord5 = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
var num = (v) => typeof v === "number" && Number.isFinite(v) ? v : null;
function fileIn(dir, rel) {
  const clean = rel.replace(/[?#].*$/, "").replace(/^\.\//, "");
  if (!clean || path9.isAbsolute(clean) || clean.split(/[\\/]/).includes("..")) return null;
  const file = path9.join(dir, clean);
  try {
    const real = fs10.realpathSync(file);
    const base2 = fs10.realpathSync(dir);
    if (real !== base2 && !real.startsWith(base2 + path9.sep)) return null;
    return fs10.statSync(real).isFile() ? file : null;
  } catch {
    return null;
  }
}
var firstFile = (dir, ...rels) => {
  for (const rel of rels) {
    const file = fileIn(dir, rel);
    if (file) return file;
  }
  return null;
};
function pageScripts(html) {
  const out = [];
  for (const m of html.matchAll(/(["'])([\w./-]+\.js)(?:[?#][^"']*)?\1/g)) {
    const rel = m[2].replace(/^\.\//, "");
    if (!out.includes(rel)) out.push(rel);
  }
  return out;
}
function pageImages(html) {
  const block = /\bimages\s*=\s*\{([^}]*)\}/.exec(html);
  if (!block) return [];
  const out = [];
  for (const m of block[1].matchAll(/([\w$]+)\s*:\s*(?:await\s+)?[\w$.]*\(\s*(?:(["'])([^"']+)\2|([\w$]+)\s*\.\s*([\w$]+))\s*\)/g)) {
    out.push(m[3] !== void 0 ? { key: m[1], file: m[3] } : { key: m[1], seal: m[5] });
  }
  return out;
}
var IMAGE_TYPES = { svg: "image/svg+xml", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif" };
function motionId(id, taken) {
  let base2 = id.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  if (!/^[a-z]/.test(base2)) base2 = `s${base2}`;
  base2 = base2.slice(0, 32).replace(/-$/, "") || "s";
  let out = base2;
  for (let n = 2; taken.has(out); n++) out = `${base2.slice(0, 32 - String(n).length - 1)}-${n}`;
  taken.add(out);
  return out;
}
function moduleName(rel, taken) {
  const stem = rel.replace(/\.js$/i, "").replace(/[\\/]+/g, "-").replace(/[^A-Za-z0-9_.-]+/g, "-");
  let out = `explainer-${stem}`.slice(0, 61) + ".js";
  for (let n = 2; taken.has(out); n++) out = `explainer-${stem}`.slice(0, 60 - String(n).length) + `-${n}.js`;
  taken.add(out);
  return out;
}
var strip = (s) => s.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
function readExplainer(dir, opts = {}) {
  const notes = [];
  const rel = (file) => path9.relative(dir, file);
  const html = (() => {
    const file = fileIn(dir, "index.html");
    return file ? fs10.readFileSync(file, "utf8") : null;
  })();
  const names = fs10.readdirSync(dir);
  const variants = names.map((f) => /^script\.([a-z][a-z0-9_-]*)\.js$/.exec(f)?.[1]).filter((v) => v !== void 0);
  const data = { scripts: {}, values: {} };
  const scriptFile = (v) => (v !== null ? firstFile(dir, `script.${v}.js`) : null) ?? firstFile(dir, "script.js");
  let variant = opts.variant ?? (variants.includes("zh") ? "zh" : variants[0] ?? null);
  const sFile = scriptFile(variant);
  if (!sFile) throw new ExplainerError(`${dir} has no script${variant ? `.${variant}` : ""}.js: is it an explainer project (script, timings, audio/, film-core.js, index.html)?`);
  readData(sFile, data, notes, dir);
  if (variant === null) {
    const keys = Object.keys(data.scripts).filter((k) => k !== "");
    if (keys.length > 0 && !Array.isArray(data.scripts[""])) variant = keys.includes("zh") ? "zh" : keys[0];
  }
  const others = [.../* @__PURE__ */ new Set([...variants, ...Object.keys(data.scripts).filter((k) => k !== "")])].filter((v) => v !== variant);
  const script2 = (variant !== null ? data.scripts[variant] : void 0) ?? data.scripts[""];
  if (!Array.isArray(script2) || script2.length === 0) {
    throw new ExplainerError(`${rel(sFile)} sets no script${variant ? ` for ${variant}` : ""} as plain data (root.SCRIPT${variant ? ` or root.SCRIPTS.${variant}` : ""} = [{id, title, lines}, \u2026])${others.length ? `; it has ${others.join(", ")} (--v)` : ""}.`);
  }
  const tFile = (variant !== null ? firstFile(dir, `timings.${variant}.js`) : null) ?? firstFile(dir, "timings.js");
  if (tFile) readData(tFile, data, notes, dir);
  else notes.push(`no timings${variant ? `.${variant}` : ""}.js: each scene is timed by its take alone, its lines' times guessed from their words.`);
  const configFile = firstFile(dir, "film.config.js");
  const brandFile = firstFile(dir, "engine/brand.js", "brand.js");
  const sealFile = firstFile(dir, "seal.js", "seals.js", "engine/seal.js");
  for (const file of [configFile, brandFile]) if (file) readData(file, data, notes, dir);
  const engineFile = firstFile(dir, "engine/film-core.js", "film-core.js");
  if (!engineFile) throw new ExplainerError(`${dir} has no film-core.js (nor engine/film-core.js), the engine that draws the film.`);
  const engine = fs10.readFileSync(engineFile, "utf8");
  let width = 0;
  let height = 0;
  let lang = "";
  const variantsAt = /\bVARIANTS\s*=\s*(?=\{)/.exec(engine);
  if (variantsAt) {
    try {
      const all = parseLiteral(engine, variantsAt.index + variantsAt[0].length).value;
      const v = isRecord5(all) ? all[variant ?? "zh"] ?? Object.values(all)[0] : null;
      if (isRecord5(v)) {
        width = num(v.w) ?? 0;
        height = num(v.h) ?? 0;
        if (typeof v.lang === "string") lang = v.lang;
      }
    } catch {
    }
  }
  if (!width || !height) {
    const wh = /\bW\s*=\s*(\d+)\s*,\s*H\s*=\s*(\d+)/.exec(engine) ?? /\bW\s*=\s*(\d+)\s*;[\s\S]{0,200}?\bH\s*=\s*(\d+)/.exec(engine);
    if (wh) [width, height] = [Number(wh[1]), Number(wh[2])];
  }
  if (opts.size !== void 0) {
    const m = /^(\d{2,5})x(\d{2,5})$/.exec(opts.size);
    if (!m) throw new ExplainerError(`--size ${opts.size}: give it as <width>x<height>, for example 1080x1920.`);
    [width, height] = [Number(m[1]), Number(m[2])];
  }
  if (!width || !height) throw new ExplainerError(`${rel(engineFile)} gives no frame size this can read (VARIANTS {w, h}, or W = \u2026, H = \u2026): give it, --size 1080x1920.`);
  const lines0 = script2.flatMap((s) => isRecord5(s) && Array.isArray(s.lines) ? s.lines : []).join("");
  if (!lang) lang = variant ?? (/[㐀-鿿]/.test(lines0) ? "zh" : "en");
  const brandRec = isRecord5(data.values.BRAND) ? data.values.BRAND : {};
  const brand = { ...brandRec, ...isRecord5(brandRec[lang]) ? brandRec[lang] : {} };
  const entries = script2.map((s, i) => {
    if (!isRecord5(s) || typeof s.id !== "string" || !s.id) throw new ExplainerError(`${rel(sFile)}: scene ${i + 1} has no id.`);
    return { id: s.id, title: typeof s.title === "string" ? s.title : "", lines: s.lines };
  });
  const brandScenes = /\bwithBrand\b/.test(engine) && /['"]brand_intro['"]/.test(engine);
  if (brandScenes && Array.isArray(brand.intro) && !entries.some((s) => s.id === "brand_intro")) {
    const en = lang === "en";
    entries.splice(1, 0, { id: "brand_intro", title: en ? "Brand intro" : "\u56FA\u5B9A\u5F00\u573A", lines: brand.intro });
    entries.push({ id: "brand_outro", title: en ? "Brand outro" : "\u56FA\u5B9A\u7ED3\u5C3E", lines: Array.isArray(brand.outro) ? brand.outro : [] });
  }
  const holdDefault = /\boutroHold\s*==\s*null\s*\?\s*(\d*\.?\d+)/.exec(engine);
  const hold = num(brand.outroHold) ?? (holdDefault ? Number(holdDefault[1]) : 0);
  const gapAt = /\bGAP\s*=\s*(\d*\.?\d+)/.exec(engine);
  const gap = gapAt ? Number(gapAt[1]) : 0.45;
  const timings = isRecord5(data.values.TIMINGS) ? data.values.TIMINGS : {};
  const charTimes = isRecord5(data.values.CHAR_TIMES) ? data.values.CHAR_TIMES : {};
  const ids = /* @__PURE__ */ new Set();
  const scenes = entries.map((s, i) => {
    const lines = Array.isArray(s.lines) ? s.lines : null;
    if (!lines || lines.length === 0 || !lines.every((l) => typeof l === "string" && strip(l) !== "")) {
      throw new ExplainerError(`${rel(sFile)}: scene ${s.id}'s lines are not a list of words.`);
    }
    const chars = Array.isArray(charTimes[s.id]) && charTimes[s.id].every((x) => num(x) !== null) ? charTimes[s.id] : null;
    const speech = num(timings[s.id]);
    const take = firstFile(dir, ...variant ? [`audio/${variant}/${s.id}.mp3`, `audio/${variant}/${s.id}.wav`] : [], `audio/${s.id}.mp3`, `audio/${s.id}.wav`);
    return {
      id: motionId(s.id, ids),
      engine: s.id,
      title: s.title || s.id,
      lines,
      speech: speech !== null && speech > 0 ? speech : null,
      chars,
      hold: i === entries.length - 1 && s.id === "brand_outro" ? hold : 0,
      take
    };
  });
  const taken = /* @__PURE__ */ new Set();
  const code = (file) => ({ file: rel(file), module: moduleName(rel(file), taken), text: fs10.readFileSync(file, "utf8") });
  const load = [configFile, brandFile, engineFile].filter((f) => f !== null).map(code);
  const skip = new Set([sFile, tFile, configFile, brandFile, sealFile, engineFile].filter((f) => f !== null).map((f) => path9.resolve(f)));
  const otherVariant = (name) => others.some((o) => name.includes(`.${o}.`) || name.startsWith(`${o}.`));
  const listed = html ? pageScripts(html) : names.filter((f) => /\.js$/.test(f) && /(^|[-._])(scenes?|shared)([-._]|$)/i.test(f)).sort((a, b) => Number(/shared/i.test(b)) - Number(/shared/i.test(a)) || (a.replace(/\.js$/, "") < b.replace(/\.js$/, "") ? -1 : 1));
  const draw = [];
  for (const name of listed) {
    const file = fileIn(dir, name);
    if (!file || skip.has(path9.resolve(file)) || otherVariant(path9.basename(name)) || /^script\.|^timings\./.test(path9.basename(name))) continue;
    skip.add(path9.resolve(file));
    draw.push(code(file));
  }
  if (draw.length === 0) throw new ExplainerError(`found no scene files${html ? " among the scripts index.html loads" : " (no index.html, and no scenes*.js)"}.`);
  const images = [];
  const assetNames = /* @__PURE__ */ new Set();
  const assetName = (name) => {
    let out = name.replace(/[^A-Za-z0-9_.-]+/g, "-").replace(/^[^A-Za-z0-9]+/, "").slice(0, 64) || "image";
    for (let n = 2; assetNames.has(out); n++) out = `${n}-${out}`.slice(0, 64);
    assetNames.add(out);
    return out;
  };
  let wanted = html ? pageImages(html) : [];
  if (wanted.length === 0) {
    for (const d of ["engine", "."]) {
      for (const f of fs10.existsSync(path9.join(dir, d)) ? fs10.readdirSync(path9.join(dir, d)) : []) {
        const m = /^seal[-_]([\w]+)\.svg$/.exec(f);
        if (m && !wanted.some((w) => w.key === m[1])) wanted.push({ key: m[1], file: path9.posix.join(d, f) });
      }
    }
  }
  const seals = (() => {
    if (!wanted.some((w) => w.seal) || !sealFile) return {};
    const into = { scripts: {}, values: {} };
    readData(sealFile, into, notes, dir);
    return isRecord5(into.values.SEALS) ? into.values.SEALS : {};
  })();
  wanted = wanted.filter((w, i) => wanted.findIndex((x) => x.key === w.key) === i);
  for (const w of wanted) {
    if (w.file !== void 0) {
      const file = fileIn(dir, w.file);
      const mime = IMAGE_TYPES[path9.extname(w.file).slice(1).toLowerCase()];
      if (!file || !mime) {
        notes.push(`image ${w.key} (${w.file}) is not an image file of the project; the engine draws without it.`);
        continue;
      }
      images.push({ key: w.key, asset: assetName(path9.basename(file)), bytes: fs10.readFileSync(file), mime });
    } else {
      const uri = seals[w.seal];
      const m = typeof uri === "string" ? /^data:(image\/(?:png|jpeg|webp|gif|svg\+xml));base64,([A-Za-z0-9+/=\s]+)$/.exec(uri) : null;
      if (!m) {
        notes.push(`image ${w.key} (SEALS.${w.seal}) is not a data: image in ${sealFile ? rel(sealFile) : "seal.js"}; the engine draws without it.`);
        continue;
      }
      const ext = Object.keys(IMAGE_TYPES).find((k) => IMAGE_TYPES[k] === m[1]) ?? "png";
      images.push({ key: w.key, asset: assetName(`seal-${w.seal}.${ext}`), bytes: Buffer.from(m[2], "base64"), mime: m[1] });
    }
  }
  const film = isRecord5(data.values.FILM) ? data.values.FILM : {};
  const titled = typeof film.title === "string" ? film.title : isRecord5(film.title) ? film.title[lang] ?? film.title[variant ?? ""] ?? Object.values(film.title).find((v) => typeof v === "string") : void 0;
  const pageTitle = html ? /<title>([^<]*)<\/title>/i.exec(html)?.[1]?.trim() : void 0;
  const title = Array.from(String(titled || pageTitle || path9.basename(dir)).trim()).slice(0, 120).join("");
  const fonts = html ? [...html.matchAll(/fonts\.googleapis\.com\/css2?\?([^"']+)/g)].flatMap((m) => [...m[1].matchAll(/family=([^:&]+)/g)].map((f) => decodeURIComponent(f[1].replace(/\+/g, " ")))) : [];
  if (others.length) notes.push(`imported the ${variant} variant; the project also has ${others.join(", ")} (--v, into another folder).`);
  return { dir, variant, others, lang, title, width, height, gap, scenes, load, draw, images, fonts, notes };
}
var guessSpeech = (lines, lang) => Math.max(1, Math.round(lines.reduce((n, l) => n + strip(l).length, 0) / (lang === "zh" ? 4.9 : 15.5) * 100) / 100);
var alignedChars = (s) => s.chars !== null && s.chars.length === s.lines.reduce((n, l) => n + strip(l).length, 0) + 1;
var BOOT = `// Made by \`artifact.mjs import-explainer\`. The film is an explainer project's own engine and scene code (the
// modules explainer-*.js, run in the order explainer.json gives, as the project's page ran them), which draws each frame
// whole on kit.fx. The script, timings and character times it reads are voice.json's, so a line changed or a take
// recorded again there is what it draws; its timeline is scenes.json's, so a scene's dur is where the engine puts it.
const X = kit.json('explainer.json');
if (!X || !Array.isArray(X.scenes)) throw new Error('explainer.json is missing, or is not {"v": 1, "scenes": [...]}');
const voice = kit.json('voice.json');
const said = Object.create(null);
for (const v of voice && Array.isArray(voice.scenes) ? voice.scenes : []) if (v && typeof v.id === 'string' && !said[v.id]) said[v.id] = v;
const script = [];
const timings = {};
const chars = {};
for (const s of X.scenes) {
  const v = said[s.id] || {};
  script.push({ id: s.engine, title: s.title || s.engine, lines: Array.isArray(v.lines) ? v.lines.slice() : [] });
  if (typeof v.speech === 'number' && v.speech > 0) timings[s.engine] = v.speech;
  if (Array.isArray(v.chars)) chars[s.engine] = v.chars;
}
if (X.variant) {
  window.VARIANT = X.variant;
  (window.SCRIPTS = window.SCRIPTS || {})[X.variant] = script;
}
window.SCRIPT = script;
window.TIMINGS = timings;
window.CHAR_TIMES = chars;
for (const name of [].concat(X.load || [], X.draw || [])) kit.exec(name);
const Film = window.Film;
if (!Film || typeof Film.init !== 'function' || typeof Film.render !== 'function') throw new Error('the engine (' + (X.load || []).join(', ') + ') set no window.Film with init and render');
if (Film.W !== kit.W || Film.H !== kit.H) console.warn('explainer: the engine draws ' + Film.W + 'x' + Film.H + ' and the film is ' + kit.W + 'x' + kit.H + ' (scenes.json width and height)');
const images = {};
window.explainerReady = Promise.all(
  Object.keys(X.images || {}).map((key) =>
    kit.assets.image(X.images[key]).then(
      (img) => { images[key] = img; },
      (e) => console.warn('explainer: image ' + key + ' (' + X.images[key] + '): ' + e.message),
    ),
  ),
).then(() => {
  const TL = Film.init({ images, createCanvas: (w, h) => Object.assign(document.createElement('canvas'), { width: w, height: h }) });
  // The engine's timeline becomes the film's: scenes.json's order and durations, and kit.cue's cues.
  const of = Object.create(null);
  for (const sc of TL.scenes) of[sc.id] = sc;
  const engine = Object.create(null);
  for (const s of X.scenes) engine[s.id] = s.engine;
  const kept = [];
  let at = 0;
  for (const s of (kit.json('scenes.json') || {}).scenes || []) {
    const sc = of[engine[s.id]];
    if (sc) {
      const c = kit.cue(s.id);
      sc.start = at;
      sc.dur = s.dur;
      if (c && sc.cues && c.length === sc.cues.length) sc.cues = c;
      kept.push(sc);
    }
    at += s.dur;
  }
  TL.scenes.splice(0, TL.scenes.length, ...kept);
  TL.total = at;
  Film.duration = at;
});
`;
var sceneModule = (id, engine) => `// Scene ${engine.replace(/[^\x20-\x7e\u00a0-\uffff]|[\u2028\u2029]/g, " ")} of the explainer (import-explainer): the project's engine draws it, the whole frame on kit.fx with
// its transitions, subtitles and watermarks, at the film's time. shared.js brings the engine up.
kit.scene('${id}', {
  init: () => window.explainerReady || Promise.reject(new Error('shared.js did not bring the explainer engine up')),
  render: (t, kit) => window.Film.render(kit.fx, kit.start + Math.max(0, Math.min(t, kit.dur - 0.001))),
});
`;

function sorted(value) {
  if (Array.isArray(value)) return value.map(sorted);
  if (value && typeof value === "object") {
    const out = {};
    for (const key of Object.keys(value).sort()) out[key] = sorted(value[key]);
    return out;
  }
  return value === void 0 ? null : value;
}
function voiceHash(record, scene) {
  const text = JSON.stringify(sorted([scene.lines ?? null, record.say ?? null, record.voice ?? null]));
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}
function isStaleTake(record, scene) {
  return typeof scene.audio === "string" && scene.audio !== "" && typeof scene.hash === "string" && scene.hash !== voiceHash(record, scene);
}

import { spawn as spawn4, spawnSync } from "node:child_process";
import fs12 from "node:fs";
import os7 from "node:os";
import path11 from "node:path";

import { spawn as spawn3 } from "node:child_process";
import fs11 from "node:fs";
import os6 from "node:os";
import path10 from "node:path";
var fail = (code, message) => Object.assign(new Error(message), { code });
var TIMEOUT_MS = 18e4;
async function errorOf(res, key) {
  const text = await res.text().catch(() => "");
  let message = "";
  try {
    const body = JSON.parse(text);
    message = [body?.error?.message, body?.detail?.message, body?.detail, body?.message, typeof body?.error === "string" ? body.error : null].find((m) => typeof m === "string" && m) ?? "";
  } catch {
    message = text;
  }
  let line = String(message).replace(/\s+/g, " ");
  if (key) line = line.split(key).join("***");
  line = line.replace(/\b(sk|xi|AIza)[-_A-Za-z0-9]{12,}/g, "$1-***");
  return `HTTP ${res.status}${line ? `: ${line.slice(0, 300)}` : ""}`;
}
async function post(url, headers, body, who) {
  try {
    return await fetch(url, { method: "POST", headers, body, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (error) {
    const e = error;
    throw fail("TTS_FAILED", `${who}: no answer from ${new URL(url).origin} (${e.name === "TimeoutError" ? `timed out after ${TIMEOUT_MS / 1e3} s` : e.cause?.code ?? e.message}).`);
  }
}
var base = (env, fallback) => (process.env[env] || fallback).replace(/\/+$/, "");
var gemini = {
  keys: ["GEMINI_API_KEY", "GOOGLE_API_KEY"],
  needs: "--model and --voice (a prebuilt voice name); --style optional, the pace and tone in words",
  missing: (s) => !s.model ? "a model (--model, or voice.json voice.model)" : !s.name ? "a voice (--voice, or voice.json voice.name)" : null,
  describe(req) {
    return { endpoint: `${base("GEMINI_BASE_URL", "https://generativelanguage.googleapis.com")}/v1beta/interactions`, body: geminiBody(req) };
  },
  async speak(req, key) {
    const url = `${base("GEMINI_BASE_URL", "https://generativelanguage.googleapis.com")}/v1beta/interactions`;
    const res = await post(url, { "x-goog-api-key": key, "content-type": "application/json" }, JSON.stringify(geminiBody(req)), "gemini");
    if (!res.ok) throw fail("TTS_FAILED", `gemini ${await errorOf(res, key)} (model ${req.settings.model}, voice ${req.settings.name}; the voice is never swapped for another).`);
    const data = await res.json().catch(() => null);
    let audio = data?.output_audio?.data ?? data?.outputAudio?.data;
    if (!audio) {
      for (const step of [...data?.steps ?? []].reverse()) {
        const part = [...step?.content ?? []].reverse().find((p) => p?.type === "audio" && p.data);
        if (part) {
          audio = part.data;
          break;
        }
      }
    }
    if (!audio) throw fail("TTS_FAILED", "gemini answered without audio.");
    return { bytes: Buffer.from(audio, "base64") };
  }
};
function geminiBody(req) {
  const s = req.settings;
  return {
    model: s.model,
    input: [{ type: "user_input", content: [{ type: "text", text: req.text, ...s.style ? { annotations: [{ type: "speech_metadata", style: s.style }] } : {} }] }],
    response_format: { type: "audio", mime_type: "audio/wav" },
    generation_config: { speech_config: [{ voice: s.name }] }
  };
}
var openai = {
  keys: ["OPENAI_API_KEY"],
  needs: "--model and --voice; --style optional (sent as instructions, where the model takes them)",
  speed: [0.25, 4],
  missing: (s) => !s.model ? "a model (--model, or voice.json voice.model)" : !s.name ? "a voice (--voice, or voice.json voice.name)" : null,
  describe(req) {
    return { endpoint: `${base("OPENAI_BASE_URL", "https://api.openai.com/v1")}/audio/speech`, body: openaiBody(req) };
  },
  async speak(req, key) {
    const res = await post(
      `${base("OPENAI_BASE_URL", "https://api.openai.com/v1")}/audio/speech`,
      { authorization: `Bearer ${key}`, "content-type": "application/json" },
      JSON.stringify(openaiBody(req)),
      "openai"
    );
    if (!res.ok) throw fail("TTS_FAILED", `openai ${await errorOf(res, key)} (model ${req.settings.model}, voice ${req.settings.name}).`);
    return { bytes: Buffer.from(await res.arrayBuffer()) };
  }
};
function openaiBody(req) {
  const s = req.settings;
  return { model: s.model, voice: s.name, input: req.plain, response_format: "wav", ...s.style ? { instructions: s.style } : {}, ...s.speed !== void 0 ? { speed: s.speed } : {} };
}
var elevenlabs = {
  keys: ["ELEVENLABS_API_KEY"],
  needs: "--voice (a voice id from the account); --model optional",
  speed: [0.7, 1.2],
  missing: (s) => !s.name ? "a voice id (--voice, or voice.json voice.name)" : null,
  describe(req) {
    return { endpoint: elevenUrl(req), body: elevenBody(req) };
  },
  async speak(req, key) {
    const res = await post(elevenUrl(req), { "xi-api-key": key, "content-type": "application/json", accept: "audio/mpeg" }, JSON.stringify(elevenBody(req)), "elevenlabs");
    if (!res.ok) throw fail("TTS_FAILED", `elevenlabs ${await errorOf(res, key)} (voice ${req.settings.name}).`);
    return { bytes: Buffer.from(await res.arrayBuffer()) };
  }
};
var elevenUrl = (req) => `${base("ELEVENLABS_BASE_URL", "https://api.elevenlabs.io")}/v1/text-to-speech/${encodeURIComponent(req.settings.name ?? "")}?output_format=mp3_44100_128`;
var elevenBody = (req) => ({
  text: req.plain,
  ...req.settings.model ? { model_id: req.settings.model } : {},
  ...req.settings.speed !== void 0 ? { voice_settings: { speed: req.settings.speed } } : {}
});
var command = {
  keys: [],
  needs: `--command "<shell command>" or MOTION_TTS_COMMAND: a program of the user's own that writes a wav or mp3 to $MOTION_TTS_OUT`,
  speed: [0.25, 4],
  missing: (_s, cmd2) => !cmd2 ? 'the program to run: --command "<shell command>" or MOTION_TTS_COMMAND (never read from the film)' : null,
  describe(req, cmd2) {
    return { command: cmd2, stdin: req.plain };
  },
  async speak(req, _key, cmd2) {
    const dir = fs11.mkdtempSync(path10.join(os6.tmpdir(), "claude-motion-tts-"));
    try {
      const out = path10.join(dir, "take.wav");
      const textFile = path10.join(dir, "text.txt");
      fs11.writeFileSync(textFile, req.plain);
      const s = req.settings;
      const env = {
        ...process.env,
        MOTION_TTS_OUT: out,
        MOTION_TTS_TEXT: req.text,
        MOTION_TTS_PLAIN: req.plain,
        MOTION_TTS_TEXT_FILE: textFile,
        MOTION_TTS_LANG: req.lang,
        MOTION_TTS_VOICE: s.name ?? "",
        MOTION_TTS_MODEL: s.model ?? "",
        MOTION_TTS_STYLE: s.style ?? "",
        MOTION_TTS_SPEED: s.speed === void 0 ? "" : String(s.speed)
      };
      const { code, stderr } = await new Promise((resolve, reject) => {
        const child = spawn3(cmd2, { shell: true, env, stdio: ["pipe", "ignore", "pipe"] });
        let err = "";
        child.stderr.on("data", (c) => err = (err + c).slice(-2e3));
        child.on("error", reject);
        child.on("close", (c) => resolve({ code: c, stderr: err }));
        child.stdin.on("error", () => {
        });
        child.stdin.end(req.plain);
      });
      if (code !== 0) throw fail("TTS_FAILED", `the TTS command exited ${code}${stderr.trim() ? `: ${stderr.trim().split("\n").slice(-3).join(" | ")}` : ""}`);
      if (!fs11.existsSync(out) || fs11.statSync(out).size === 0) throw fail("TTS_FAILED", "the TTS command wrote nothing to $MOTION_TTS_OUT.");
      return { bytes: fs11.readFileSync(out) };
    } finally {
      fs11.rmSync(dir, { recursive: true, force: true });
    }
  }
};
var PROVIDERS = { gemini, openai, elevenlabs, command };
function providerKey(name, provider) {
  if (provider.keys.length === 0) return null;
  for (const k of provider.keys) if (process.env[k]) return process.env[k];
  throw fail(
    "NO_KEY",
    `The ${name} provider needs an API key in the environment: ${provider.keys.join(" or ")}. Set it in the shell that runs this command; it is sent to the provider only, never written to the film or printed.`
  );
}

var CJK = /[぀-ヿ㐀-䶿一-鿿豈-﫿가-힯]/;
var voiceStrip = (text) => text.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
var isLatin = (lang, lines) => typeof lang === "string" && lang ? !/^(zh|ja|ko|yue|cmn)/i.test(lang) : !lines.some((l) => CJK.test(l));
function charWeight(ch, latin) {
  if (latin) {
    if (/[A-Za-z]/.test(ch)) return 1;
    if (/[0-9]/.test(ch)) return 2.5;
    if (ch === " ") return 0.4;
    if (/[,;:—]/.test(ch)) return 3;
    if (/[.?!]/.test(ch) || ch === "%") return 6;
    return 0;
  }
  if (CJK.test(ch) || /[0-9]/.test(ch)) return 1;
  if (/[A-Za-z]/.test(ch)) return 0.36;
  if (/[，、：；]/.test(ch)) return 1;
  if (/[。？！]/.test(ch)) return 1.8;
  if (ch === "%" || ch === ".") return 1.6;
  return 0;
}
function sceneText(lines, latin) {
  const texts = lines.map(voiceStrip);
  const full = texts.join("");
  const offs = [];
  let off = 0;
  for (const t of texts) {
    offs.push(off);
    off += t.length;
  }
  const cum = new Float64Array(full.length + 1);
  for (let j = 0; j < full.length; j++) {
    const code = full.charCodeAt(j);
    const w = code >= 56320 && code <= 57343 ? 0 : charWeight(String.fromCodePoint(full.codePointAt(j)), latin);
    cum[j + 1] = cum[j] + w;
  }
  return { full, texts, offs, cum };
}
function decodeWav(b) {
  if (b.length < 12 || b.toString("latin1", 0, 4) !== "RIFF" || b.toString("latin1", 8, 12) !== "WAVE") return null;
  let format = 0;
  let channels = 0;
  let rate = 0;
  let bits = 0;
  for (let at = 12; at + 8 <= b.length; ) {
    const id = b.toString("latin1", at, at + 4);
    let size = b.readUInt32LE(at + 4);
    if (id === "fmt " && at + 24 <= b.length) {
      format = b.readUInt16LE(at + 8);
      channels = b.readUInt16LE(at + 10);
      rate = b.readUInt32LE(at + 12);
      bits = b.readUInt16LE(at + 22);
      if (format === 65534 && at + 34 <= b.length) format = b.readUInt16LE(at + 32);
    }
    if (id === "data") {
      if (!channels || !rate || !bits) return null;
      if (size === 0 || at + 8 + size > b.length) size = b.length - at - 8;
      const bytes = bits / 8;
      const frames = Math.floor(size / (bytes * channels));
      const out = new Float32Array(frames);
      const read = format === 3 && bits === 32 ? (o) => b.readFloatLE(o) : format === 3 && bits === 64 ? (o) => b.readDoubleLE(o) : format === 1 && bits === 16 ? (o) => b.readInt16LE(o) / 32768 : format === 1 && bits === 24 ? (o) => b.readIntLE(o, 3) / 8388608 : format === 1 && bits === 32 ? (o) => b.readInt32LE(o) / 2147483648 : format === 1 && bits === 8 ? (o) => (b[o] - 128) / 128 : null;
      if (!read) return null;
      const start = at + 8;
      for (let f = 0; f < frames; f++) {
        let sum = 0;
        for (let c = 0; c < channels; c++) sum += read(start + (f * channels + c) * bytes);
        out[f] = sum / channels;
      }
      return { rate, samples: out };
    }
    at += 8 + size + (size & 1);
  }
  return null;
}
var ffmpegFound;
function findFfmpeg() {
  if (ffmpegFound !== void 0) return ffmpegFound;
  const candidate = process.env.FFMPEG_PATH || "ffmpeg";
  const r = spawnSync(candidate, ["-hide_banner", "-version"], { stdio: "ignore" });
  ffmpegFound = r.status === 0 ? candidate : null;
  return ffmpegFound;
}
function ffmpegPipe(args, input) {
  const ffmpeg = findFfmpeg();
  if (!ffmpeg) return Promise.reject(fail("NO_FFMPEG", "ffmpeg is not here (FFMPEG_PATH, or on the PATH)."));
  return new Promise((resolve, reject) => {
    const child = spawn4(ffmpeg, ["-hide_banner", "-loglevel", "error", "-i", "pipe:0", ...args, "pipe:1"], { stdio: ["pipe", "pipe", "pipe"] });
    const out = [];
    let err = "";
    child.stdout.on("data", (c) => out.push(c));
    child.stderr.on("data", (c) => err = (err + c).slice(-1e3));
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve(Buffer.concat(out)) : reject(fail("FFMPEG_FAILED", `ffmpeg exited ${code}: ${err.trim().split("\n").pop() ?? ""}`)));
    child.stdin.on("error", () => {
    });
    child.stdin.end(input);
  });
}
async function decodeAudio(bytes, mime, name) {
  const wav = decodeWav(bytes);
  if (wav) return wav;
  if (!findFfmpeg()) throw fail("NO_FFMPEG", `${name} is ${mime}; align reads a wav itself and anything else through ffmpeg, which is not here. Install ffmpeg (or set FFMPEG_PATH), or make the takes as wav.`);
  const raw = await ffmpegPipe(["-ac", "1", "-ar", "16000", "-f", "f32le"], bytes);
  return { rate: 16e3, samples: new Float32Array(raw.buffer, raw.byteOffset, Math.floor(raw.length / 4)).slice() };
}
function encodeWav(pcm, rate = pcm.rate) {
  const ratio = pcm.rate / rate;
  const n = Math.floor(pcm.samples.length / ratio);
  const b = Buffer.alloc(44 + n * 2);
  b.write("RIFF", 0);
  b.writeUInt32LE(36 + n * 2, 4);
  b.write("WAVEfmt ", 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24);
  b.writeUInt32LE(rate * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write("data", 36);
  b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const x = i * ratio;
    const i0 = Math.floor(x);
    const a = pcm.samples[i0] ?? 0;
    const c = pcm.samples[Math.min(i0 + 1, pcm.samples.length - 1)] ?? a;
    const v = a + (c - a) * (x - i0);
    b.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(v * 32767))), 44 + i * 2);
  }
  return b;
}
var HOP = 0.01;
var MIN_PAUSE = 0.12;
function findPauses(pcm) {
  const hop = Math.max(1, Math.round(pcm.rate * HOP));
  const win = hop * 2;
  const n = Math.max(0, Math.floor((pcm.samples.length - win) / hop) + 1);
  const db = new Float32Array(n);
  for (let f = 0; f < n; f++) {
    let sum = 0;
    for (let i = f * hop; i < f * hop + win; i++) sum += pcm.samples[i] * pcm.samples[i];
    db[f] = 10 * Math.log10(sum / win + 1e-12);
  }
  const length = pcm.samples.length / pcm.rate;
  if (n === 0) return { start: 0, end: length, pauses: [] };
  const sorted2 = Float32Array.from(db).sort();
  const floor = sorted2[Math.floor(n * 0.1)];
  const loud = sorted2[Math.min(n - 1, Math.floor(n * 0.95))];
  if (loud - floor < 10) return { start: 0, end: length, pauses: [] };
  const threshold = Math.max(floor + 0.3 * (loud - floor), loud - 32);
  const voiced = Array.from(db, (x) => x > threshold);
  let first = voiced.indexOf(true);
  let last = voiced.lastIndexOf(true);
  if (first < 0) return { start: 0, end: length, pauses: [] };
  const time = (f) => (f * hop + win / 2) / pcm.rate;
  const pauses = [];
  for (let f = first; f <= last; ) {
    if (voiced[f]) {
      f++;
      continue;
    }
    let g = f;
    while (g <= last && !voiced[g]) g++;
    if (time(g) - time(f) >= MIN_PAUSE) pauses.push({ s: time(f), e: time(g) });
    f = g;
  }
  return { start: Math.max(0, time(first) - HOP), end: Math.min(length, time(last) + HOP * 2), pauses };
}
var STRONG = /[。！？.!?…]/;
var WEAK = /[，、；：,;:—]/;
var CLOSER = /[”’"'）)」』】\]\s]/;
function anchorsOf(t) {
  const out = /* @__PURE__ */ new Map();
  t.texts.forEach((text, i) => {
    const off = t.offs[i];
    for (let j = 0; j < text.length; j++) {
      const ch = text[j];
      const latinPunct = /[,.;:!?]/.test(ch);
      if (!STRONG.test(ch) && !WEAK.test(ch)) continue;
      if (latinPunct && j + 1 < text.length && !/\s/.test(text[j + 1])) continue;
      let strong = STRONG.test(ch);
      let k = j + 1;
      while (k < text.length && (STRONG.test(text[k]) || WEAK.test(text[k]) || CLOSER.test(text[k]))) {
        if (STRONG.test(text[k])) strong = true;
        k++;
      }
      if (k < text.length) out.set(off + k, { k: off + k, run: off + j, skip: strong ? 2 : 1, line: false });
      j = k - 1;
    }
    if (i > 0) {
      let run = off;
      while (run > t.offs[i - 1] && (STRONG.test(t.full[run - 1]) || WEAK.test(t.full[run - 1]) || CLOSER.test(t.full[run - 1]))) run--;
      out.set(off, { k: off, run, skip: 4, line: true });
    }
  });
  return [...out.values()].sort((a, b) => a.k - b.k);
}
function alignBySilence(pcm, t, takeSeconds) {
  const total = t.full.length;
  const { start, end, pauses: found } = findPauses(pcm);
  const anchors = anchorsOf(t);
  const W = t.cum[total];
  let pauses = found;
  const keep = Math.max(2 * anchors.length + 8, 24);
  if (pauses.length > keep) pauses = [...pauses].sort((a, b) => b.e - b.s - (a.e - a.s)).slice(0, keep).sort((a, b) => a.s - b.s);
  const A = anchors.length;
  const P = pauses.length;
  const runW = anchors.reduce((n, a) => n + (t.cum[a.k] - t.cum[a.run]), 0);
  const paused = pauses.reduce((n, p) => n + (p.e - p.s), 0);
  const rate = Math.max(1e-3, end - start - paused) / Math.max(1e-6, W - runW);
  const pauseSkip = (p) => Math.min(3, 0.2 + 3 * (p.e - p.s));
  const skipA = new Float64Array(A + 1);
  anchors.forEach((a, i) => skipA[i + 1] = skipA[i] + a.skip);
  const skipP = new Float64Array(P + 1);
  pauses.forEach((p, i) => skipP[i + 1] = skipP[i] + pauseSkip(p));
  const kAfter = (a) => a === 0 ? 0 : anchors[a - 1].k;
  const kBefore = (a) => a === A + 1 ? total : anchors[a - 1].run;
  const tAfter = (p) => p === 0 ? start : pauses[p - 1].e;
  const tBefore = (p) => p === P + 1 ? end : pauses[p - 1].s;
  const seg = (a1, p1, a2, p2) => {
    const expected = rate * (t.cum[kBefore(a2)] - t.cum[kAfter(a1)]);
    const actual = tBefore(p2) - tAfter(p1);
    if (actual < 0) return Infinity;
    const r = Math.log((actual + 0.15) / (expected + 0.15));
    return 6 * r * r + (skipA[a2 - 1] - skipA[a1]) + (skipP[p2 - 1] - skipP[p1]);
  };
  const cols = P + 2;
  const best = new Float64Array((A + 2) * cols).fill(Infinity);
  const from = new Int32Array((A + 2) * cols).fill(-1);
  best[0] = 0;
  for (let a = 1; a <= A + 1; a++) {
    const pLo = a === A + 1 ? P + 1 : 1;
    const pHi = a === A + 1 ? P + 1 : P;
    for (let p = pLo; p <= pHi; p++) {
      let b = Infinity;
      let arg = -1;
      for (let a1 = 0; a1 < a; a1++) {
        for (let p1 = a1 === 0 ? 0 : 1; p1 < p; p1++) {
          if (a1 === 0 && p1 !== 0) break;
          const before = best[a1 * cols + p1];
          if (before === Infinity) continue;
          const c = before + seg(a1, p1, a, p);
          if (c < b) {
            b = c;
            arg = a1 * cols + p1;
          }
        }
      }
      best[a * cols + p] = b;
      from[a * cols + p] = arg;
    }
  }
  const matches = [];
  for (let node = from[(A + 1) * cols + P + 1]; node > 0; node = from[node]) matches.unshift({ a: Math.floor(node / cols), p: node % cols });
  const times = new Float64Array(total + 1);
  const span = (k02, t02, k1, t1) => {
    const w = t.cum[k1] - t.cum[k02];
    for (let j = k02; j < k1; j++) times[j] = w > 0 ? t02 + (t.cum[j] - t.cum[k02]) / w * (t1 - t02) : t02;
  };
  let k0 = 0;
  let t0 = start;
  for (const { a, p } of matches) {
    const anchor = anchors[a - 1];
    const pause = pauses[p - 1];
    span(k0, t0, anchor.run, pause.s);
    span(anchor.run, pause.s, anchor.k, pause.e);
    k0 = anchor.k;
    t0 = pause.e;
  }
  span(k0, t0, total, end);
  const chars = [];
  let last = 0;
  for (let j = 0; j < total; j++) {
    last = Math.max(last, Math.round(times[j] * 100) / 100);
    chars.push(last);
  }
  chars.push(Math.max(last, Math.round(takeSeconds * 100) / 100));
  const lineBreaks = anchors.filter((a) => a.line).length;
  const lineMatched = matches.filter(({ a }) => anchors[a - 1].line).length;
  return {
    chars,
    report: {
      speech: [round2(start), round2(end)],
      pauses: found.length,
      breaks: A,
      matched: matches.length,
      lineStarts: `${lineMatched + 1} of ${t.texts.length} on a pause or the start`,
      ...lineMatched < lineBreaks ? { note: "some line starts fell in no pause: their times are spread by weight" } : {}
    }
  };
}
var round2 = (n) => Math.round(n * 100) / 100;
var KEEP = /[\p{L}\p{N}]/u;
function charsFromWords(t, words, takeSeconds) {
  const total = t.full.length;
  const idx = [];
  const mine = [];
  for (let j = 0; j < total; j++) if (KEEP.test(t.full[j])) idx.push(j), mine.push(t.full[j].toLowerCase());
  const heard = [];
  const at = [];
  for (const w of words) {
    if (!(w.end - w.start >= 0.02)) continue;
    const cs = [...String(w.text)].filter((c) => KEEP.test(c));
    cs.forEach((c, k) => (heard.push(c.toLowerCase()), at.push(w.start + (w.end - w.start) * k / cs.length)));
  }
  const n = mine.length;
  const m = heard.length;
  const known = /* @__PURE__ */ new Map();
  if (n && m) {
    const L = new Uint16Array((n + 1) * (m + 1));
    for (let i = n - 1; i >= 0; i--)
      for (let j = m - 1; j >= 0; j--) L[i * (m + 1) + j] = mine[i] === heard[j] ? L[(i + 1) * (m + 1) + j + 1] + 1 : Math.max(L[(i + 1) * (m + 1) + j], L[i * (m + 1) + j + 1]);
    for (let i = 0, j = 0; i < n && j < m; ) {
      if (mine[i] === heard[j]) {
        known.set(idx[i], at[j]);
        i++;
        j++;
      } else if (L[(i + 1) * (m + 1) + j] >= L[i * (m + 1) + j + 1]) i++;
      else j++;
    }
  }
  const points = [...known.entries()].sort((a, b) => a[0] - b[0]);
  const start = points.length ? Math.min(points[0][1], words[0]?.start ?? points[0][1]) : 0;
  const end = Math.min(takeSeconds, Math.max(words.at(-1)?.end ?? takeSeconds, points.at(-1)?.[1] ?? 0));
  const fixed = [[0, start], ...points.filter(([k]) => k > 0), [total, end]];
  const times = new Float64Array(total + 1);
  for (let f = 0; f + 1 < fixed.length; f++) {
    const [k0, t0] = fixed[f];
    const [k1, t1] = fixed[f + 1];
    const w = t.cum[k1] - t.cum[k0];
    for (let j = k0; j < k1; j++) times[j] = w > 0 ? t0 + (t.cum[j] - t.cum[k0]) / w * (t1 - t0) : t0;
  }
  const chars = [];
  let last = 0;
  for (let j = 0; j < total; j++) {
    last = Math.max(last, round2(times[j]));
    chars.push(last);
  }
  chars.push(Math.max(last, round2(takeSeconds)));
  return { chars, report: { heard: m, matched: known.size, of: n, match: n ? `${Math.round(100 * known.size / n)}%` : "n/a" } };
}
async function alignByCommand(command2, pcm, t, lang, takeSeconds) {
  const dir = fs12.mkdtempSync(path11.join(os7.tmpdir(), "claude-motion-align-"));
  try {
    const audio = path11.join(dir, "take.wav");
    fs12.writeFileSync(audio, encodeWav(pcm, 16e3));
    const textFile = path11.join(dir, "text.txt");
    const text = t.texts.join("\n");
    fs12.writeFileSync(textFile, text);
    const env = { ...process.env, MOTION_ALIGN_AUDIO: audio, MOTION_ALIGN_TEXT: text, MOTION_ALIGN_TEXT_FILE: textFile, MOTION_ALIGN_LANG: lang };
    const { code, stdout, stderr } = await new Promise((resolve, reject) => {
      const child = spawn4(command2, { shell: true, env, stdio: ["pipe", "pipe", "pipe"] });
      let out2 = "";
      let err = "";
      child.stdout.on("data", (c) => out2 += c);
      child.stderr.on("data", (c) => err = (err + c).slice(-2e3));
      child.on("error", reject);
      child.on("close", (c) => resolve({ code: c, stdout: out2, stderr: err }));
      child.stdin.on("error", () => {
      });
      child.stdin.end(JSON.stringify({ audio, text, lines: t.texts, lang, speech: takeSeconds }));
    });
    if (code !== 0) throw fail("ALIGN_FAILED", `the align command exited ${code}${stderr.trim() ? `: ${stderr.trim().split("\n").slice(-3).join(" | ")}` : ""}`);
    let out;
    try {
      out = JSON.parse(stdout.trim().split("\n").filter(Boolean).pop() ?? "");
    } catch {
      throw fail("ALIGN_FAILED", 'the align command printed no JSON ({"chars": [...]} or {"words": [{"text", "start", "end"}]}) as its last line.');
    }
    const total = t.full.length;
    if (Array.isArray(out?.chars)) {
      const chars = out.chars;
      if (chars.length !== total + 1 || !chars.every((x) => typeof x === "number" && Number.isFinite(x)))
        throw fail("ALIGN_FAILED", `the align command gave ${chars.length} times; the lines have ${total} characters, so ${total + 1} with the end.`);
      let last = 0;
      return { chars: chars.map((x) => last = Math.max(last, round2(x))), report: { from: "chars" } };
    }
    const words = Array.isArray(out?.words) ? out.words : Array.isArray(out?.characters) ? out.characters : null;
    if (!words || !words.every((w) => w && typeof w.text === "string" && typeof w.start === "number" && typeof w.end === "number"))
      throw fail("ALIGN_FAILED", 'the align command printed neither {"chars": [...]} nor {"words": [{"text", "start", "end"}, ...]}.');
    return charsFromWords(t, words, takeSeconds);
  } finally {
    fs12.rmSync(dir, { recursive: true, force: true });
  }
}

import fs14 from "node:fs";
import path13 from "node:path";
import { pathToFileURL } from "node:url";

import { spawn as spawn5 } from "node:child_process";
import fs13 from "node:fs";
import os8 from "node:os";
import path12 from "node:path";
var CANDIDATES = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/snap/bin/chromium",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe"
];
function findChrome() {
  const given = process.env.CHROME_PATH;
  if (given) return fs13.existsSync(given) ? given : null;
  return CANDIDATES.find((p) => fs13.existsSync(p)) ?? null;
}
var sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function launchChrome(chrome, args = []) {
  const profile = fs13.mkdtempSync(path12.join(os8.tmpdir(), "baoyu-chrome-"));
  const child = spawn5(
    chrome,
    [
      "--headless=new",
      "--remote-debugging-port=0",
      `--user-data-dir=${profile}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-extensions",
      "--disable-background-networking",
      "--disable-sync",
      "--disable-component-update",
      // a long export runs in a tab nobody looks at: keep its timers and frames at full speed
      "--disable-background-timer-throttling",
      "--disable-renderer-backgrounding",
      "--disable-backgrounding-occluded-windows",
      "--mute-audio",
      ...args,
      "about:blank"
    ],
    { stdio: ["ignore", "ignore", "pipe"] }
  );
  const removeProfile = () => fs13.rmSync(profile, { recursive: true, force: true });
  let endpoint;
  try {
    endpoint = await new Promise((resolve, reject) => {
      let text = "";
      const timer = setTimeout(() => reject(new Error(`Chrome did not start in 30 s: ${text.slice(-400)}`)), 3e4);
      child.stderr.on("data", (chunk) => {
        text += chunk;
        const m = /DevTools listening on (ws:\/\/\S+)/.exec(text);
        if (m) {
          clearTimeout(timer);
          resolve(m[1]);
        }
      });
      child.on("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
      child.on("exit", (code) => {
        clearTimeout(timer);
        reject(new Error(`Chrome exited (${code}): ${text.slice(-400)}`));
      });
    });
  } catch (error) {
    child.kill("SIGKILL");
    removeProfile();
    throw error;
  }
  const ws = new WebSocket(endpoint);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", () => resolve(), { once: true });
    ws.addEventListener("error", () => reject(new Error("could not connect to Chrome")), { once: true });
  });
  let nextId = 1;
  const pending = /* @__PURE__ */ new Map();
  const listeners = /* @__PURE__ */ new Set();
  ws.addEventListener("message", (event) => {
    const msg = JSON.parse(String(event.data));
    if (msg.id !== void 0) {
      const p = pending.get(msg.id);
      pending.delete(msg.id);
      if (!p) return;
      if (msg.error) p.reject(new Error(`${p.method}: ${msg.error.message}`));
      else p.resolve(msg.result);
    } else for (const fn of listeners) fn(msg);
  });
  ws.addEventListener("close", () => {
    for (const p of pending.values()) p.reject(new Error("Chrome closed"));
    pending.clear();
  });
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject, method });
    ws.send(JSON.stringify({ id, method, params, ...sessionId ? { sessionId } : {} }));
  });
  async function page() {
    const { targetId } = await send("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
    const problems = [];
    let loaded = false;
    listeners.add((msg) => {
      if (msg.sessionId !== sessionId) return;
      const p = msg.params;
      if (msg.method === "Page.loadEventFired") loaded = true;
      else if (msg.method === "Runtime.exceptionThrown") {
        const d = p.exceptionDetails;
        problems.push({ type: "exception", text: String(d.exception?.description ?? d.text).split("\n").slice(0, 3).join(" | ") });
      } else if (msg.method === "Runtime.consoleAPICalled" && (p.type === "error" || p.type === "assert")) {
        problems.push({ type: p.type, text: p.args.map((a) => a.value ?? a.description ?? a.type).join(" ").slice(0, 400) });
      }
    });
    await send("Page.enable", {}, sessionId);
    await send("Runtime.enable", {}, sessionId);
    return {
      problems,
      send: (method, params = {}) => send(method, params, sessionId),
      onEvent(method, fn) {
        listeners.add((msg) => {
          if (msg.sessionId === sessionId && msg.method === method) fn(msg.params);
        });
      },
      async navigate(url, timeoutMs = 3e4) {
        loaded = false;
        await send("Page.navigate", { url }, sessionId);
        const until = Date.now() + timeoutMs;
        while (!loaded) {
          if (Date.now() > until) throw new Error(`the page did not load in ${Math.round(timeoutMs / 1e3)} s`);
          await sleep(50);
        }
      },
      async evaluate(expression) {
        const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }, sessionId);
        if (r.exceptionDetails) throw new Error(String(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text).split("\n")[0]);
        return r.result?.value;
      }
    };
  }
  async function close() {
    try {
      await Promise.race([send("Browser.close"), sleep(3e3)]);
    } catch {
    }
    try {
      ws.close();
    } catch {
    }
    await new Promise((resolve) => {
      if (child.exitCode !== null || child.signalCode !== null) return resolve();
      const timer = setTimeout(() => {
        child.kill("SIGKILL");
        resolve();
      }, 3e3);
      child.on("exit", () => {
        clearTimeout(timer);
        resolve();
      });
    });
    removeProfile();
  }
  return { page, close };
}

var isObject2 = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
var sleep2 = (ms) => new Promise((r) => setTimeout(r, ms));
var log = (line) => process.stderr.write(`${line}
`);
var SEND_CHUNK = 2 * 1024 * 1024;
var READ_CHUNK = 4 * 1024 * 1024;
function positive(flags, name, max) {
  const given = flags.get(name);
  if (given === void 0) return void 0;
  const n = Number(given);
  if (!Number.isFinite(n) || n <= 0 || n > max) throw fail("INVALID_FLAG", `--${name} is a number above 0, ${max} at most.`);
  return n;
}
async function openFilm(store, what) {
  const chrome = findChrome();
  if (!chrome)
    throw fail(
      "NO_CHROME",
      process.env.CHROME_PATH ? `CHROME_PATH is ${process.env.CHROME_PATH}, which is no file.` : `No Chrome here to ${what} with: install Google Chrome (or Chromium, Edge, Brave), or set CHROME_PATH to its program.`
    );
  const index = path13.join(store.editorDir, "index.html");
  if (!fs14.existsSync(index)) throw fail("NO_PLAYER", `The player is not here (${index}); the skill's scripts/editor is incomplete.`);
  const { docs, damaged } = store.readAllDocs();
  if (damaged.length) throw fail("DAMAGED_DOCUMENT", `${damaged.join(", ")} ${damaged.length === 1 ? "is" : "are"} not JSON: ${store.cmd("check", store.root)}.`);
  const script2 = docs.get("film/script")?.code;
  if (typeof script2 !== "string" || !script2.trim()) throw fail("NO_SCRIPT", `film/script has no code: there is no film to ${what} yet.`);
  const meta = docs.get("film/meta");
  const title = isObject2(meta) && typeof meta.title === "string" && meta.title.trim() ? meta.title.trim() : "Film";
  const modules = [...docs].filter(([p]) => /^modules\/[^/]+$/.test(p)).map(([p, d]) => ({ name: p.slice("modules/".length), kind: String(d.kind ?? ""), text: String(d.text ?? "") })).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
  const warnings = [];
  const assets = [];
  for (const [p, d] of docs) {
    if (!/^assets\/[^/]+$/.test(p)) continue;
    const bytes = store.assetBytes(d);
    if (!bytes) {
      warnings.push(`${p}: its upload is missing, so the film is played without it.`);
      continue;
    }
    assets.push({ name: p.slice("assets/".length), mime: String(d.mime ?? ""), ...typeof d.w === "number" ? { w: d.w } : {}, ...typeof d.h === "number" ? { h: d.h } : {}, bytes });
  }
  let takes = 0;
  const voiceDoc = docs.get("modules/voice.json");
  try {
    const voice = voiceDoc ? JSON.parse(String(voiceDoc.text)) : null;
    if (isObject2(voice) && Array.isArray(voice.scenes)) takes = voice.scenes.filter((s) => isObject2(s) && typeof s.audio === "string" && assets.some((a) => a.name === s.audio)).length;
  } catch {
  }
  let browser = null;
  const stopOnSignal = () => {
    void (browser ? browser.close() : Promise.resolve()).finally(() => process.exit(130));
  };
  process.once("SIGINT", stopOnSignal);
  process.once("SIGTERM", stopOnSignal);
  const close = async () => {
    process.removeListener("SIGINT", stopOnSignal);
    process.removeListener("SIGTERM", stopOnSignal);
    if (browser) await browser.close();
  };
  try {
    browser = await launchChrome(chrome, ["--autoplay-policy=no-user-gesture-required", "--force-color-profile=srgb", "--hide-scrollbars"]);
    const page = await browser.page();
    await page.navigate(`${pathToFileURL(index).href}#tools-voice`);
    for (let i = 0; !await page.evaluate('typeof window.__animation === "object" && window.__animation !== null').catch(() => false); i++) {
      if (i > 300) throw fail("PLAYER_FAILED", `the player did not start in 30 s${page.problems.length ? `: ${page.problems[0].text}` : ""}.`);
      await sleep2(100);
    }
    await page.evaluate("(window.__motionIn = [], true)");
    for (let i = 0; i < assets.length; i++) {
      const b64 = assets[i].bytes.toString("base64");
      await page.evaluate(`(window.__motionIn[${i}] = [], true)`);
      for (let at = 0; at < b64.length; at += SEND_CHUNK) await page.evaluate(`(window.__motionIn[${i}].push(${JSON.stringify(b64.slice(at, at + SEND_CHUNK))}), true)`);
    }
    const files = { title, script: script2, modules, assets: assets.map(({ bytes: _, ...a }, i) => ({ ...a, i })) };
    log(`${what}: loading ${title} (${modules.length} modules, ${assets.length} assets)`);
    const loaded = await page.evaluate(
      `(async () => { const files = ${JSON.stringify(files)}; files.assets = files.assets.map(({ i, ...a }) => ({ ...a, base64: window.__motionIn[i].join('') })); delete window.__motionIn; return await window.__animation.load(files); })()`
    );
    if (!isObject2(loaded) || loaded.error) {
      const why = isObject2(loaded?.error) ? loaded.error.message : loaded?.error ?? "no answer";
      throw fail("LOAD_FAILED", `the player could not load the film: ${why}${page.problems.length ? ` (${page.problems.map((p) => p.text).slice(0, 2).join(" | ")})` : ""}. ${store.cmd("check", store.root)} says what is wrong.`);
    }
    return { page, meta: isObject2(loaded.meta) ? loaded.meta : {}, title, takes, warnings, close };
  } catch (error) {
    await close();
    throw error;
  }
}
async function playWarnings(film) {
  const runner = await film.page.evaluate("window.__animation.consoleLog()").catch(() => []);
  return [
    ...Array.isArray(runner) ? runner.filter((l) => isObject2(l) && l.level !== "log").slice(0, 5).map((l) => `the film's ${l.level}: ${String(l.text).slice(0, 400)}`) : [],
    ...film.page.problems.slice(0, 5).map((p) => `the page: ${p.text}`)
  ];
}
function captionCues(meta) {
  const out = [];
  for (const v of Array.isArray(meta.voice) ? meta.voice : []) {
    if (!isObject2(v) || typeof v.at !== "number" || !Array.isArray(v.subs)) continue;
    for (const s of v.subs) if (isObject2(s) && typeof s.a === "number" && typeof s.b === "number" && s.b > s.a && typeof s.text === "string" && s.text.trim()) out.push({ a: v.at + s.a, b: v.at + s.b, text: s.text.trim(), scene: String(v.id) });
  }
  return out.sort((x, y) => x.a - y.a);
}
function captionFile(cues, format) {
  const stamp = (t) => {
    const ms = Math.max(0, Math.round(t * 1e3));
    const p = (n, w = 2) => String(n).padStart(w, "0");
    return `${p(Math.floor(ms / 36e5))}:${p(Math.floor(ms / 6e4) % 60)}:${p(Math.floor(ms / 1e3) % 60)}${format === "srt" ? "," : "."}${p(ms % 1e3, 3)}`;
  };
  const blocks = cues.map((c, i) => `${format === "srt" ? `${i + 1}
` : ""}${stamp(c.a)} --> ${stamp(c.b)}
${c.text}
`);
  return `${format === "vtt" ? "WEBVTT\n\n" : ""}${blocks.join("\n")}`;
}
async function exportAudio(store, flags) {
  const given = flags.get("out");
  const film = await openFilm(store, "export");
  const started = Date.now();
  try {
    const safe = film.title.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ").trim().slice(0, 80) || "film";
    const outFile = given && given !== "true" ? path13.resolve(given) : path13.join(store.root, "exports", `${safe} (sound).wav`);
    const ext = path13.extname(outFile).toLowerCase();
    if (![".wav", ".mp3", ".m4a"].includes(ext)) throw fail("INVALID_FLAG", `--out is a .wav, .mp3 or .m4a file with --audio-only, not ${path13.basename(outFile)}.`);
    if (ext !== ".wav" && !findFfmpeg()) throw fail("NO_FFMPEG", `--out ${path13.basename(outFile)} needs ffmpeg to encode, which is not here: write a .wav.`);
    const audio = await film.page.evaluate(`window.__animation.renderAudio({ title: ${JSON.stringify(film.title)} })`);
    if (!isObject2(audio) || typeof audio.wav !== "string") throw fail("EXPORT_FAILED", `the player rendered no sound${film.page.problems.length ? ` (${film.page.problems[0].text})` : ""}.`);
    const parts = [];
    for (let at = 0; at < audio.wavBytes; at += READ_CHUNK) parts.push(Buffer.from(await film.page.evaluate(`window.__animation.read(${JSON.stringify(audio.wav)}, ${at}, ${READ_CHUNK})`), "base64"));
    for (const blob of [audio.wav, audio.mid]) if (typeof blob === "string") await film.page.evaluate(`window.__animation.free(${JSON.stringify(blob)})`).catch(() => {
    });
    let bytes = Buffer.concat(parts);
    if (ext === ".mp3") bytes = await ffmpegPipe(["-c:a", "libmp3lame", "-b:a", "192k", "-f", "mp3"], bytes);
    if (ext === ".m4a") bytes = await ffmpegPipe(["-c:a", "aac", "-b:a", "192k", "-movflags", "frag_keyframe+empty_moov", "-f", "mp4"], bytes);
    fs14.mkdirSync(path13.dirname(outFile), { recursive: true });
    fs14.writeFileSync(outFile, bytes);
    const report = await film.page.evaluate("window.__animation.scoreReport()").catch(() => ({}));
    const warnings = [...film.warnings, ...await playWarnings(film)];
    const dbfs3 = (x) => x > 0 ? Math.round(200 * Math.log10(x)) / 10 : -99;
    return {
      root: store.root,
      out: outFile,
      bytes: bytes.length,
      seconds: Math.round(Number(audio.seconds) * 100) / 100,
      loudness: { lufs: Math.round(Number(audio.lufs) * 10) / 10, peak: dbfs3(Number(audio.peak)) },
      ...isObject2(report.speech) ? { speech: report.speech } : {},
      ...Array.isArray(report.beds) ? { beds: report.beds } : {},
      ms: Date.now() - started,
      ...warnings.length ? { warnings } : {},
      next: "listen to it; score <root> measures the same sound by numbers (levels, the music between the takes)"
    };
  } finally {
    await film.close();
  }
}
async function exportCommand(store, flags) {
  if (flags.has("audio-only") || flags.has("no-video")) return exportAudio(store, flags);
  const height = positive(flags, "height", 4320);
  const fps = positive(flags, "fps", 120);
  const stallSeconds = positive(flags, "timeout", 3600) ?? 180;
  const quality = flags.get("quality") ?? "high";
  if (!["low", "medium", "high"].includes(quality)) throw fail("INVALID_FLAG", "--quality is low, medium or high.");
  const captions = flags.get("captions") === "true" ? "srt" : flags.get("captions");
  if (captions !== void 0 && captions !== "srt" && captions !== "vtt") throw fail("INVALID_FLAG", "--captions is srt (the default) or vtt.");
  const film = await openFilm(store, "export");
  const { page, title, takes } = film;
  const warnings = film.warnings;
  let outFd = null;
  let outFile = "";
  try {
    const meta = film.meta;
    const short = Math.min(Number(meta.width) || 1920, Number(meta.height) || 1080);
    const settings = { height: height ?? short, ...fps ? { fps } : {}, quality, title, ...flags.has("supersample") ? { supersample: true } : {} };
    const speech = await page.evaluate("window.__animation.scoreReport().speech").catch(() => null);
    await page.evaluate(
      `(() => { const s = window.__motionExport = { p: null, done: null }; window.__animation.exportFilm(Object.assign(${JSON.stringify(settings)}, { onProgress: (d, t, ph) => { s.p = [d, t, ph]; } })).then((r) => { s.done = r; }, (e) => { s.done = { error: String((e && e.message) || e) }; }); return true; })()`
    );
    const started = Date.now();
    let last = "";
    let lastChange = Date.now();
    let lastLog = 0;
    let done = null;
    for (; ; ) {
      await sleep2(500);
      const s = await page.evaluate("({ p: window.__motionExport.p, done: window.__motionExport.done })");
      if (s.done) {
        done = s.done;
        break;
      }
      const now = JSON.stringify(s.p);
      if (now !== last) {
        last = now;
        lastChange = Date.now();
        if (s.p && Date.now() - lastLog > 5e3) {
          lastLog = Date.now();
          log(`export: ${s.p[2]} ${s.p[0]}/${s.p[1]} (${Math.round((Date.now() - started) / 1e3)} s)`);
        }
      } else if (Date.now() - lastChange > stallSeconds * 1e3) {
        throw fail("EXPORT_STALLED", `the export made no progress for ${stallSeconds} s (at ${now}); --timeout <seconds> waits longer.`);
      }
    }
    if (!done || done.error || typeof done.blob !== "string") throw fail("EXPORT_FAILED", `the player's export failed: ${done?.error ?? "no result"}${page.problems.length ? ` (${page.problems[0].text})` : ""}`);
    const ext = String(done.filename ?? "").split(".").pop() || (String(done.mime).includes("webm") ? "webm" : "mp4");
    outFile = flags.get("out") ? path13.resolve(flags.get("out")) : path13.join(store.root, "exports", String(done.filename || `film.${ext}`));
    if (path13.extname(outFile).slice(1).toLowerCase() !== ext) warnings.push(`the video is ${done.mime} (.${ext}), but ${path13.basename(outFile)} says otherwise.`);
    fs14.mkdirSync(path13.dirname(outFile), { recursive: true });
    const tmp = `${outFile}.part`;
    outFd = fs14.openSync(tmp, "w");
    for (let at = 0; at < done.bytes; at += READ_CHUNK) {
      const piece = await page.evaluate(`window.__animation.read(${JSON.stringify(done.blob)}, ${at}, ${READ_CHUNK})`);
      fs14.writeSync(outFd, Buffer.from(piece, "base64"));
    }
    fs14.closeSync(outFd);
    outFd = null;
    fs14.renameSync(tmp, outFile);
    await page.evaluate(`window.__animation.free(${JSON.stringify(done.blob)})`).catch(() => {
    });
    const plan = done.plan ?? {};
    let captionsFile;
    if (captions) {
      const cues = captionCues(meta);
      if (!cues.length) warnings.push("--captions: the film has no captions (no voice.json lines), so no captions file was written.");
      else {
        captionsFile = outFile.replace(/\.[^./\\]+$/, "") + `.${captions}`;
        fs14.writeFileSync(captionsFile, captionFile(cues, captions));
      }
    }
    if (takes > 0 && (!speech || speech.lines < takes)) warnings.push(`voice.json has ${takes} takes but the film speaks ${speech?.lines ?? 0}: ${store.cmd("check", store.root)} says which are silent.`);
    warnings.push(...await playWarnings(film));
    return {
      root: store.root,
      out: outFile,
      bytes: done.bytes,
      mime: done.mime,
      ...plan.format?.label ? { format: plan.format.label } : {},
      width: plan.width,
      height: plan.height,
      fps: plan.fps,
      frames: plan.frames,
      seconds: plan.fps ? Math.round(plan.frames / plan.fps * 100) / 100 : void 0,
      ms: Math.round(Number(done.ms) || 0),
      ...speech ? { speech } : {},
      ...captionsFile ? { captions: captionsFile } : {},
      ...warnings.length ? { warnings } : {}
    };
  } finally {
    if (outFd !== null) {
      fs14.closeSync(outFd);
      fs14.rmSync(`${outFile}.part`, { force: true });
    }
    await film.close();
  }
}

import fs15 from "node:fs";
import path14 from "node:path";
var isObject3 = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
var round22 = (n) => Math.round(n * 100) / 100;
var log2 = (line) => process.stderr.write(`${line}
`);
function prettyJson(v, ind = "") {
  if (Array.isArray(v)) {
    if (v.length === 0) return "[]";
    if (v.every((x) => typeof x === "number")) return `[${v.map((x) => JSON.stringify(x)).join(", ")}]`;
    const inner = `${ind}  `;
    return `[
${v.map((x) => inner + prettyJson(x, inner)).join(",\n")}
${ind}]`;
  }
  if (isObject3(v)) {
    const entries = Object.entries(v).filter(([, x]) => x !== void 0);
    if (entries.length === 0) return "{}";
    const inner = `${ind}  `;
    return `{
${entries.map(([k, x]) => `${inner}${JSON.stringify(k)}: ${prettyJson(x, inner)}`).join(",\n")}
${ind}}`;
  }
  return JSON.stringify(v) ?? "null";
}
function moduleWrites(store, docs, name, kind, text) {
  const limit = store.maxDocBytes - 4096;
  const chunks = [];
  if (store.storeBytes({ kind, text }) <= limit) chunks.push(text);
  else {
    let rest = text;
    while (rest) {
      let n = Math.min(rest.length, Math.max(1, Math.floor(rest.length * limit / store.storeBytes({ kind, text: rest }))));
      while (n > 1 && store.storeBytes({ kind, text: rest.slice(0, n) }) > limit) n = Math.floor(n * 0.9);
      const code = rest.charCodeAt(n - 1);
      if (n < rest.length && code >= 55296 && code <= 56319) n--;
      chunks.push(rest.slice(0, n));
      rest = rest.slice(n);
    }
    if (chunks.length > 99) throw fail("TOO_LARGE", `modules/${name} would need ${chunks.length} parts; 99 at most.`);
  }
  const paths = chunks.length === 1 ? [`modules/${name}`] : chunks.map((_, i) => `modules/${name}~${i + 1}`);
  const writes = chunks.map((chunk, i) => ({ op: "set", path: paths[i], data: { kind, text: chunk } }));
  const mine = new RegExp(`^modules/${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(~[1-9][0-9]?)?$`);
  for (const p of docs.keys()) if (mine.test(p) && !paths.includes(p)) writes.push({ op: "delete", path: p });
  return writes;
}
function readTrack(store, docs) {
  const found = store.moduleText(docs, "voice.json");
  if (!found) throw fail("NO_VOICE_TRACK", 'The film has no modules/voice.json. Write it first: {"v": 1, "lang": "zh", "scenes": [{"id": "<scene id>", "lines": ["\u2026", "\u2026"]}]}.');
  let voice;
  try {
    voice = JSON.parse(found.text);
  } catch (error) {
    throw fail("INVALID_VOICE_TRACK", `modules/voice.json is not JSON: ${error.message}`);
  }
  if (!isObject3(voice) || !Array.isArray(voice.scenes)) throw fail("INVALID_VOICE_TRACK", 'modules/voice.json is {"v": 1, "lang": "zh", "scenes": [{id, lines}]}.');
  return { voice, kind: found.kind || "json" };
}
function linesOf(scene) {
  if (!Array.isArray(scene.lines) || scene.lines.length === 0) return null;
  return scene.lines.every((l) => typeof l === "string" && voiceStrip(l) !== "") ? scene.lines : null;
}
function onlyOf(flags, voice) {
  const given = flags.get("only");
  if (!given || given === "true") return null;
  const ids = given.split(",").map((s) => s.trim()).filter(Boolean);
  const known = voice.scenes.filter(isObject3).map((s) => s.id);
  const unknown = ids.filter((id) => !known.includes(id));
  if (unknown.length) throw fail("UNKNOWN_SCENE", `${unknown.join(", ")}: no such scene in voice.json (it has ${known.join(", ")}).`);
  return new Set(ids);
}
function sayPairs(voice) {
  return isObject3(voice.say) ? Object.entries(voice.say).filter(([k, v]) => k !== "" && typeof v === "string") : [];
}
function said(voice, lines) {
  let out = lines;
  const used = [];
  for (const [k, v] of sayPairs(voice)) {
    if (!out.some((l) => l.includes(k))) continue;
    used.push([k, v]);
    out = out.map((l) => l.split(k).join(v));
  }
  return { lines: out, used };
}
var setting = (v) => typeof v === "string" && v.trim() ? v.trim() : void 0;
var TAKE_FLAGS = ["provider", "model", "voice", "style", "speed", "command", "only", "force"];
var tagOf = (voice) => {
  const lang = typeof voice.lang === "string" ? voice.lang : "";
  return /^[A-Za-z0-9-]{1,16}$/.test(lang) ? `${lang.toLowerCase()}-` : "";
};
function formatOf(flags, what) {
  const format = flags.get("format") ?? (findFfmpeg() ? "mp3" : "keep");
  if (!["mp3", "wav", "keep"].includes(format)) throw fail("INVALID_FLAG", `--format is mp3 (the default when ffmpeg is here), wav, or keep (${what}).`);
  if (format !== "keep" && !findFfmpeg()) throw fail("NO_FFMPEG", `--format ${format} converts the take with ffmpeg, which is not here (FFMPEG_PATH, or on the PATH). Leave --format out to keep it as it is.`);
  return format;
}
async function keepTake(store, docs, voice, kind, scene, bytes, format, hash, from) {
  let take = bytes;
  let mime = store.sniffType(take);
  if (mime !== "audio/wav" && mime !== "audio/mpeg") throw fail("TTS_FAILED", `${scene.id}: ${from} is ${mime ?? "bytes"}, neither a wav nor an mp3.`);
  if (format === "mp3" && mime === "audio/wav") {
    take = await ffmpegPipe(["-ac", "1", "-c:a", "libmp3lame", "-b:a", "96k", "-f", "mp3"], take);
    mime = "audio/mpeg";
  } else if (format === "wav" && mime === "audio/mpeg") {
    take = await ffmpegPipe(["-ac", "1", "-c:a", "pcm_s16le", "-f", "wav"], take);
    mime = "audio/wav";
  }
  const seconds = store.audioSeconds(take, mime);
  if (seconds === null || seconds <= 0) throw fail("TTS_FAILED", `${scene.id}: the length of ${from} can't be read (${mime}, ${take.length} bytes).`);
  const asset = `voice-${tagOf(voice)}${scene.id}.${mime === "audio/wav" ? "wav" : "mp3"}`;
  const blob = store.putBlob(take, asset, mime);
  scene.audio = asset;
  scene.speech = round22(seconds);
  scene.hash = hash;
  delete scene.chars;
  delete scene.align;
  store.applyWrites([{ op: "set", path: `assets/${asset}`, data: { ref: blob.url, mime } }, ...moduleWrites(store, docs, "voice.json", kind, `${prettyJson(voice)}
`)]);
  const warnings = [];
  if (take.length > store.maxTakeKib * 1024) warnings.push(`${scene.id}: its take is ${Math.round(take.length / 1024)} KiB; the player leaves a take over ${store.maxTakeKib} KiB silent: make it an mp3 (install ffmpeg) or split the scene.`);
  if (seconds > store.maxTakeSeconds) warnings.push(`${scene.id}: its take runs ${round22(seconds)} s; the player leaves a take over ${store.maxTakeSeconds} s silent: split the scene in two.`);
  return { docs: store.readAllDocs().docs, made: { id: scene.id, asset, seconds: round22(seconds), bytes: take.length, mime }, warnings };
}
function speedOf(flags, was) {
  const given = flags.get("speed");
  if (given === void 0) return typeof was.speed === "number" && Number.isFinite(was.speed) && was.speed !== 1 ? was.speed : void 0;
  if (given === "none") return void 0;
  const n = Number(given);
  if (!Number.isFinite(n) || n < 0.25 || n > 4) throw fail("INVALID_FLAG", "--speed is the pace as a factor (1.1 a little faster, 0.9 a little slower), 0.25 to 4; 1 or none for the provider's own.");
  return n === 1 ? void 0 : n;
}
function onPath(name) {
  for (const dir of (process.env.PATH ?? "").split(path14.delimiter).filter(Boolean)) {
    const file = path14.join(dir, name);
    try {
      if (fs15.statSync(file).isFile()) {
        fs15.accessSync(file, fs15.constants.X_OK);
        return file;
      }
    } catch {
    }
  }
  return null;
}
function macVoices() {
  if (process.platform !== "darwin" || !onPath("say")) return null;
  const ffmpeg = findFfmpeg();
  if (!ffmpeg) return null;
  const run = ffmpeg === "ffmpeg" ? "ffmpeg" : `"${ffmpeg}"`;
  const command2 = `say -v "$MOTION_TTS_VOICE" -r 210 -o "$MOTION_TTS_OUT.aiff" -f "$MOTION_TTS_TEXT_FILE" && ${run} -loglevel error -y -i "$MOTION_TTS_OUT.aiff" -ac 1 -ar 24000 "$MOTION_TTS_OUT" && rm -f "$MOTION_TTS_OUT.aiff"`;
  return {
    ready: true,
    what: "the Mac's own voices (say), as draft takes: good for timing; a provider with a key, or their own recording, sounds better",
    voices: `say -v '?' lists them with their languages (Chinese: Tingting, Meijia; English: Samantha, Daniel, where installed). A name several languages share (Eddy, Flo) needs its whole name as listed, "Eddy (Chinese (China mainland))": alone it is the first, which may not speak the lines' language and makes a near-empty take`,
    run: `voice <root> --provider command --voice <a voice say lists> --command '${command2}'`,
    rate: "-r is words a minute: about 210 suits Chinese, 150 English",
    note: 'pass --command with every voice run (it is never kept in the film); voice.json keeps "voice": {"provider": "command", "name": "<the voice>"}'
  };
}
function providersCommand() {
  const providers = Object.entries(PROVIDERS).map(([name, p]) => {
    const ready = name === "command" ? !!setting(process.env.MOTION_TTS_COMMAND) : p.keys.some((k) => process.env[k]);
    return {
      name,
      ready,
      ...p.keys.length ? { key: `${p.keys.join(" or ")} (${ready ? "set" : "not set"})` } : { command: `MOTION_TTS_COMMAND (${ready ? "set" : "not set"}), or --command` },
      needs: p.needs,
      speed: p.speed ? `${p.speed[0]}\u2013${p.speed[1]}` : "none (ask for the pace in --style)"
    };
  });
  const macos = macVoices();
  return {
    providers,
    ...macos ? { macos } : {},
    next: providers.some((p) => p.ready) ? `the voice is the user's to pick: offer voices of the ready providers (and their own recording${macos ? ", and this Mac's own voices as a draft: macos" : ""}), then voice <root> --provider \u2026 --voice \u2026 with what they picked; voice.json keeps it for every take after` : macos ? "no provider with a key is ready here, but this Mac's own voices are (macos): draft takes through the command provider with the command macos.run gives. Offer them, the user's own recording (voice <root> --takes <dir>) and no voice (captions only); a key set in the shell that runs these commands gives a better voice later" : "no provider is ready here: the user sets a key in the shell that runs these commands, gives a program of their own (--command), or records the takes (voice <root> --takes <dir>); or the film is captioned only"
  };
}
async function voiceCommand(store, flags) {
  if (flags.has("take") || flags.has("takes")) return adoptTakes(store, flags);
  let { docs } = store.readAllDocs();
  const { voice, kind } = readTrack(store, docs);
  const was = isObject3(voice.voice) ? voice.voice : {};
  const settings = {
    provider: setting(flags.get("provider")) ?? setting(was.provider) ?? "",
    model: setting(flags.get("model")) ?? setting(was.model),
    name: setting(flags.get("voice")) ?? setting(was.name),
    style: setting(flags.get("style")) ?? setting(was.style),
    speed: speedOf(flags, was)
  };
  const names = Object.keys(PROVIDERS).join(", ");
  if (!settings.provider) {
    const ready = Object.entries(PROVIDERS).filter(([n, p]) => n === "command" ? !!setting(process.env.MOTION_TTS_COMMAND) : p.keys.some((k) => process.env[k])).map(([n]) => n);
    throw fail(
      "NO_PROVIDER",
      `Say which text-to-speech provider makes the takes: --provider (${names}), with --model, --voice and --style as it needs; or write them in voice.json "voice": {"provider", "model", "name", "style"}. No voice is picked for you: the user picks it. Ready here (a key or MOTION_TTS_COMMAND set): ${ready.join(", ") || "none"}; command also runs with --command${macVoices() ? "; this Mac's own voices too, through command (voice --providers gives the command)" : ""}.`
    );
  }
  const provider = PROVIDERS[settings.provider];
  if (!provider) throw fail("UNKNOWN_PROVIDER", `No provider ${JSON.stringify(settings.provider)}; there are ${names}.`);
  const command2 = settings.provider === "command" ? setting(flags.get("command")) ?? setting(process.env.MOTION_TTS_COMMAND) : void 0;
  const missing = provider.missing(settings, command2);
  if (missing) throw fail("MISSING_SETTING", `The ${settings.provider} provider needs ${missing}.`);
  if (settings.speed !== void 0) {
    if (!provider.speed)
      throw fail("NO_SPEED", `The ${settings.provider} provider takes no speed setting: ask for the pace in --style (such as "a little faster"), or leave --speed out (--speed none drops the one voice.json holds).`);
    const [lo, hi] = provider.speed;
    if (settings.speed < lo || settings.speed > hi) throw fail("INVALID_FLAG", `The ${settings.provider} provider takes a speed from ${lo} to ${hi}; --speed ${settings.speed} is outside it.`);
  }
  voice.voice = { ...was, provider: settings.provider, model: settings.model, name: settings.name, style: settings.style, speed: settings.speed };
  for (const k of ["model", "name", "style", "speed"]) if (voice.voice[k] === void 0) delete voice.voice[k];
  const only = onlyOf(flags, voice);
  const force = flags.has("force");
  const dryRun = flags.has("dry-run");
  const format = formatOf(flags, "as the provider sent it");
  const lang = typeof voice.lang === "string" ? voice.lang : "";
  const tag = tagOf(voice);
  const todo = [];
  const skipped = [];
  for (const scene of voice.scenes) {
    if (!isObject3(scene) || typeof scene.id !== "string" || !scene.id) continue;
    if (only && !only.has(scene.id)) continue;
    const lines = linesOf(scene);
    if (!lines) {
      if (only) throw fail("NO_LINES", `${scene.id} has no lines to say: each line is a string with words.`);
      skipped.push({ id: scene.id, why: "no lines" });
      continue;
    }
    const hash = voiceHash(voice, scene);
    const hasTake = typeof scene.audio === "string" && docs.has(`assets/${scene.audio}`);
    if (hasTake && !force && !only) {
      if (scene.hash === hash) {
        skipped.push({ id: scene.id, why: "its take is up to date" });
        continue;
      }
      if (typeof scene.hash !== "string") {
        skipped.push({ id: scene.id, why: `has a take voice did not make (${scene.audio}): --only ${scene.id} or --force to replace it` });
        continue;
      }
    }
    todo.push({ scene, lines, hash });
  }
  const request = (lines) => {
    const say = said(voice, lines).lines;
    return { text: say.join("\n\n"), plain: say.map(voiceStrip).join("\n\n"), lang, settings };
  };
  if (dryRun) {
    return {
      root: store.root,
      dryRun: true,
      provider: settings.provider,
      ...provider.keys.length ? { key: `from ${provider.keys.join(" or ")} (${provider.keys.some((k) => process.env[k]) ? "set" : "not set"})` } : {},
      would: todo.map(({ scene, lines }) => ({ id: scene.id, asset: `voice-${tag}${scene.id}.${format === "wav" ? "wav" : format === "mp3" ? "mp3" : "<wav|mp3>"}`, ...provider.describe(request(lines), command2) })),
      ...skipped.length ? { skipped } : {}
    };
  }
  const key = todo.length ? providerKey(settings.provider, provider) : null;
  const made = [];
  const warnings = [];
  for (const { scene, lines, hash } of todo) {
    const started = Date.now();
    log2(`voice: ${scene.id} (${settings.provider}) \u2026`);
    let take;
    try {
      take = (await provider.speak(request(lines), key, command2)).bytes;
    } catch (error) {
      const e = error;
      const kept2 = made.length ? ` ${made.map((m) => m.id).join(", ")} ${made.length === 1 ? "was" : "were"} made and kept; run voice again to go on from ${scene.id}.` : "";
      throw fail(e.code ?? "TTS_FAILED", `${scene.id}: ${e.message}${kept2}`);
    }
    const kept = await keepTake(store, docs, voice, kind, scene, take, format, hash, `what the ${settings.provider} provider sent`);
    docs = kept.docs;
    warnings.push(...kept.warnings);
    made.push(kept.made);
    log2(`voice: ${scene.id} ${kept.made.seconds} s (${Math.round((Date.now() - started) / 100) / 10} s to make)`);
  }
  return {
    root: store.root,
    provider: settings.provider,
    ...settings.model ? { model: settings.model } : {},
    ...settings.name ? { voice: settings.name } : {},
    ...settings.speed !== void 0 ? { speed: settings.speed } : {},
    made,
    ...skipped.length ? { skipped } : {},
    ...warnings.length ? { warnings } : {},
    ...made.length ? { next: [`${store.cmd("align", store.root)}   when each character is said`, `${store.cmd("sync", store.root)}   each scene's length from its take`] } : {}
  };
}
async function adoptTakes(store, flags) {
  const clash = TAKE_FLAGS.filter((f) => flags.has(f));
  if (clash.length) throw fail("INVALID_FLAG", `--take adopts takes made elsewhere: leave out ${clash.map((f) => `--${f}`).join(", ")} (they are for takes voice makes).`);
  let { docs } = store.readAllDocs();
  const { voice, kind } = readTrack(store, docs);
  const known = new Map(voice.scenes.filter((s) => isObject3(s) && typeof s.id === "string" && s.id).map((s) => [s.id, s]));
  const pairs = [];
  const given = setting(flags.get("take"));
  if (flags.has("take") && (!given || given === "true")) throw fail("INVALID_FLAG", "--take is <scene id>=<file>, a comma between two: --take s01=takes/s01.mp3,s02=takes/s02.wav.");
  if (given) {
    for (const part of given.split(",")) {
      const eq = part.indexOf("=");
      if (eq <= 0 || !part.slice(eq + 1).trim()) throw fail("INVALID_FLAG", `--take ${part}: each is <scene id>=<file>, a comma between two.`);
      pairs.push([part.slice(0, eq).trim(), part.slice(eq + 1).trim()]);
    }
  }
  const dir = setting(flags.get("takes"));
  if (flags.has("takes")) {
    if (!dir || dir === "true" || !fs15.statSync(dir, { throwIfNoEntry: false })?.isDirectory()) throw fail("NOT_FOUND", `--takes ${dir ?? ""} is no folder: give the folder that holds <scene id>.mp3 or <scene id>.wav.`);
    const before = pairs.length;
    for (const id of known.keys()) {
      if (pairs.some(([p]) => p === id)) continue;
      const file = ["mp3", "wav"].map((ext) => path14.join(dir, `${id}.${ext}`)).find((f) => fs15.statSync(f, { throwIfNoEntry: false })?.isFile());
      if (file) pairs.push([id, file]);
    }
    if (pairs.length === before) throw fail("NOT_FOUND", `${dir} holds no take named for a scene of voice.json (${[...known.keys()].map((id) => `${id}.mp3`).join(", ")}).`);
  }
  const unknown = pairs.filter(([id]) => !known.has(id)).map(([id]) => id);
  if (unknown.length) throw fail("UNKNOWN_SCENE", `${unknown.join(", ")}: no such scene in voice.json (it has ${[...known.keys()].join(", ")}).`);
  const twice = pairs.map(([id]) => id).filter((id, i, all) => all.indexOf(id) !== i);
  if (twice.length) throw fail("INVALID_FLAG", `${[...new Set(twice)].join(", ")}: two takes for one scene.`);
  const format = formatOf(flags, "as the file is");
  const todo = pairs.map(([id, file]) => {
    const scene = known.get(id);
    if (!linesOf(scene)) throw fail("NO_LINES", `${id} has no lines: write what its take says in voice.json first, a beat a line, word for word.`);
    const abs = path14.resolve(file);
    if (!fs15.statSync(abs, { throwIfNoEntry: false })?.isFile()) throw fail("NOT_FOUND", `${file}: no such file (paths are relative to the current directory).`);
    return { scene, file, abs };
  });
  if (flags.has("dry-run")) return { root: store.root, dryRun: true, would: todo.map(({ scene, file }) => ({ id: scene.id, file, asset: `voice-${tagOf(voice)}${scene.id}.${format === "wav" ? "wav" : format === "mp3" ? "mp3" : "<wav|mp3>"}` })) };
  const adopted = [];
  const warnings = [];
  for (const { scene, file, abs } of todo) {
    const kept = await keepTake(store, docs, voice, kind, scene, fs15.readFileSync(abs), format, voiceHash(voice, scene), file);
    docs = kept.docs;
    warnings.push(...kept.warnings);
    adopted.push({ ...kept.made, from: file });
  }
  return {
    root: store.root,
    adopted,
    ...warnings.length ? { warnings } : {},
    next: [`${store.cmd("align", store.root)}   when each character is said`, `${store.cmd("sync", store.root)}   each scene's length from its take`]
  };
}
async function alignCommand(store, flags) {
  let { docs } = store.readAllDocs();
  const { voice, kind } = readTrack(store, docs);
  const command2 = setting(flags.get("command")) ?? setting(process.env.MOTION_ALIGN_COMMAND);
  const aligner = flags.get("aligner") ?? (command2 ? "command" : "silence");
  if (aligner !== "silence" && aligner !== "command") throw fail("UNKNOWN_ALIGNER", `No aligner ${JSON.stringify(aligner)}: silence (built in) or command (your own, --command or MOTION_ALIGN_COMMAND).`);
  if (aligner === "command" && !command2) throw fail("MISSING_SETTING", 'The command aligner runs your program: --command "<shell command>" or MOTION_ALIGN_COMMAND (never read from the film).');
  const only = onlyOf(flags, voice);
  const force = flags.has("force");
  const lang = typeof voice.lang === "string" ? voice.lang : "";
  const aligned = [];
  const skipped = [];
  for (const scene of voice.scenes) {
    if (!isObject3(scene) || typeof scene.id !== "string" || !scene.id) continue;
    if (only && !only.has(scene.id)) continue;
    const id = scene.id;
    const skip = (why) => {
      if (only) throw fail("CANNOT_ALIGN", `${id}: ${why}`);
      skipped.push({ id, why });
    };
    const lines = linesOf(scene);
    if (!lines) {
      skip("no lines");
      continue;
    }
    if (typeof scene.audio !== "string" || !scene.audio) {
      skip(`no take yet: ${store.cmd("voice", store.root)}, or upload one and name it in audio`);
      continue;
    }
    const asset = docs.get(`assets/${scene.audio}`);
    const bytes = asset ? store.assetBytes(asset) : null;
    if (!asset || !bytes) {
      skip(`its take ${scene.audio} is ${asset ? "missing from the uploads" : "no asset of this film"}`);
      continue;
    }
    const t = sceneText(lines, isLatin(voice.lang, lines));
    if (!force && !only && Array.isArray(scene.chars) && scene.chars.length === t.full.length + 1) {
      skipped.push({ id, why: "aligned already (--force or --only to align again)" });
      continue;
    }
    const mime = String(asset.mime);
    const pcm = await decodeAudio(bytes, mime, scene.audio);
    const seconds = store.audioSeconds(bytes, mime) ?? pcm.samples.length / pcm.rate;
    log2(`align: ${id} (${aligner}) \u2026`);
    const result = aligner === "silence" ? alignBySilence(pcm, t, seconds) : await alignByCommand(command2, pcm, t, lang, seconds);
    scene.chars = result.chars;
    scene.align = aligner === "silence" ? "silence" : "asr";
    store.applyWrites(moduleWrites(store, docs, "voice.json", kind, `${prettyJson(voice)}
`));
    docs = store.readAllDocs().docs;
    aligned.push({ id, characters: t.full.length, take: round22(seconds), ...result.report });
  }
  return {
    root: store.root,
    aligner,
    aligned,
    ...skipped.length ? { skipped } : {},
    ...aligned.length ? { next: `${store.cmd("check", store.root)}   the voice block counts the aligned scenes` } : {}
  };
}
function syncCommand(store, flags) {
  const { docs } = store.readAllDocs();
  const { voice, kind } = readTrack(store, docs);
  const found = store.moduleText(docs, "scenes.json");
  if (!found) throw fail("NO_SCENES", "The film has no modules/scenes.json: sync sets each scene's dur there.");
  let scenes;
  try {
    scenes = JSON.parse(found.text);
  } catch (error) {
    throw fail("INVALID_SCENES", `modules/scenes.json is not JSON: ${error.message}`);
  }
  if (!isObject3(scenes) || !Array.isArray(scenes.scenes)) throw fail("INVALID_SCENES", 'modules/scenes.json is {"v": 1, "stage", "scenes": [{id, name, dur}]}.');
  const gap = typeof voice.gap === "number" && voice.gap >= 0 && voice.gap <= 5 ? voice.gap : 0.45;
  const byId2 = new Map(scenes.scenes.filter(isObject3).map((s) => [s.id, s]));
  const changed = [];
  const notes = [];
  let voiceChanged = false;
  let scenesChanged = false;
  for (const v of voice.scenes) {
    if (!isObject3(v) || typeof v.id !== "string") continue;
    let measured = null;
    if (typeof v.audio === "string" && v.audio) {
      const asset = docs.get(`assets/${v.audio}`);
      const bytes = asset ? store.assetBytes(asset) : null;
      if (bytes) measured = store.audioSeconds(bytes, String(asset.mime));
      else notes.push(`${v.id}: its take ${v.audio} is not here; its speech is left as it is`);
    }
    let speech = typeof v.speech === "number" && Number.isFinite(v.speech) && v.speech > 0 ? v.speech : null;
    if (measured !== null && (speech === null || Math.abs(speech - round22(measured)) >= 0.01)) {
      changed.push({ id: v.id, speech: [speech, round22(measured)] });
      v.speech = speech = round22(measured);
      voiceChanged = true;
    }
    if (speech === null) continue;
    const s = byId2.get(v.id);
    if (!s) {
      notes.push(`${v.id}: no scene of scenes.json`);
      continue;
    }
    const want = round22(speech + gap);
    if (s.dur !== want) {
      changed.push({ id: v.id, dur: [s.dur, want] });
      s.dur = want;
      scenesChanged = true;
    }
  }
  const total = scenes.scenes.reduce((n, s) => n + (isObject3(s) && typeof s.dur === "number" && s.dur > 0 ? s.dur : 0), 0);
  if (total > store.maxFilmSeconds) throw fail("TOO_LONG", `With these lengths the film runs ${round22(total)} s; a film over ${store.maxFilmSeconds} s won't load. Shorten the lines or split the film. Nothing was written.`);
  const dryRun = flags.has("dry-run");
  if (!dryRun && (voiceChanged || scenesChanged)) {
    store.applyWrites([
      ...scenesChanged ? moduleWrites(store, docs, "scenes.json", found.kind || "json", `${prettyJson(scenes)}
`) : [],
      ...voiceChanged ? moduleWrites(store, docs, "voice.json", kind, `${prettyJson(voice)}
`) : []
    ]);
  }
  return {
    root: store.root,
    ...dryRun ? { dryRun: true } : {},
    gap,
    changed,
    seconds: round22(total),
    ...notes.length ? { notes } : {},
    ...changed.length && !dryRun ? { next: `${store.cmd("check", store.root)}` } : {}
  };
}

var isObject4 = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
var r3 = (n) => Math.round(n * 1e3) / 1e3;
var num2 = (x, lo, hi, d) => typeof x === "number" && Number.isFinite(x) && x >= lo && x <= hi ? x : d;
function lineWeight(line, latin) {
  let w = (line.match(/<[^>]*>/g) ?? []).length * (latin ? 7 : 2.2);
  for (const ch of voiceStrip(line)) w += charWeight(ch, latin);
  return w;
}
function wordsOf(text, latin) {
  const re = latin ? /[\p{L}\p{N}]+(?:['’.-][\p{L}\p{N}]+)*%?/gu : /[A-Za-z0-9]+(?:[.'’-][A-Za-z0-9]+)*%?|[^\s\p{P}\p{S}A-Za-z0-9]/gu;
  return [...text.matchAll(re)].map((m) => ({ w: m[0], k: m.index }));
}
function sceneBeats(voice, v, opts) {
  if (!Array.isArray(v.lines)) return null;
  const spoken = v.lines.map((l, n) => ({ l, n })).filter((x) => typeof x.l === "string" && voiceStrip(x.l) !== "");
  if (!spoken.length) return null;
  const lines = spoken.map((x) => x.l);
  const latin = isLatin(voice.lang, lines);
  const lead = num2(voice.lead, 0, 1, 0.08);
  const ws = lines.map((l) => lineWeight(l, latin));
  const sum = ws.reduce((a, b) => a + b, 0) || 1;
  const speech = num2(v.speech, 0.05, opts.maxSeconds, 0) || sum / (latin ? 15.5 : 4.9);
  const texts = lines.map(voiceStrip);
  const total = texts.reduce((a, t) => a + t.length, 0);
  const ct = v.chars;
  const real = Array.isArray(ct) && ct.length === total + 1 && ct.every((x) => typeof x === "number" && Number.isFinite(x));
  const cues = [];
  const offs = [];
  let acc = 0;
  let off = 0;
  lines.forEach((_, i) => {
    offs.push(off);
    cues.push(real ? i === 0 ? 0 : Math.max(0, ct[off] - lead) : acc / sum * speech);
    acc += ws[i];
    off += texts[i].length;
  });
  cues.push(speech);
  const out = {
    id: v.id,
    film: opts.film,
    speech: r3(speech),
    aligned: real,
    ...Array.isArray(ct) && !real ? { note: `chars holds ${ct.length} times but its lines have ${total} characters (${total + 1} times with the end): the times are guessed from the words` } : {},
    lines: []
  };
  texts.forEach((t, i) => {
    const line = { i, line: spoken[i].n, text: t, start: r3(cues[i]), end: r3(cues[i + 1]), ...opts.film !== null ? { film: r3(opts.film + cues[i]) } : {} };
    if (opts.words) {
      const cum = [0];
      const unitAt = [0];
      let u = 0;
      for (const ch of t) {
        cum.push(cum.at(-1) + charWeight(ch, latin));
        u += ch.length;
        unitAt.push(u);
      }
      const W = cum.at(-1);
      const seen = /* @__PURE__ */ new Set();
      line.words = wordsOf(t, latin).map(({ w, k }) => {
        const upto = unitAt.findIndex((x) => x >= k);
        const f = W ? cum[upto] / W : 0;
        const at = real ? Math.max(0, ct[offs[i] + k] - lead) : cues[i] + (cues[i + 1] - cues[i]) * f;
        const again = seen.has(w);
        seen.add(w);
        return { w, t: r3(at), f: r3(f), ...again ? { again: true } : {} };
      });
    }
    out.lines.push(line);
  });
  return out;
}
function beatsCommand(store, flags) {
  const { docs } = store.readAllDocs();
  const { voice } = readTrack(store, docs);
  const given = flags.get("only");
  const only = given && given !== "true" ? new Set(given.split(",").map((s) => s.trim()).filter(Boolean)) : null;
  const ids = voice.scenes.filter(isObject4).map((s) => s.id);
  if (only) {
    const unknown = [...only].filter((id) => !ids.includes(id));
    if (unknown.length) throw fail("UNKNOWN_SCENE", `${unknown.join(", ")}: no such scene in voice.json (it has ${ids.join(", ")}).`);
  }
  const starts = /* @__PURE__ */ new Map();
  const found = store.moduleText(docs, "scenes.json");
  if (found) {
    try {
      const scenes2 = JSON.parse(found.text);
      let at = 0;
      for (const s of Array.isArray(scenes2?.scenes) ? scenes2.scenes : []) {
        if (!isObject4(s)) continue;
        if (typeof s.id === "string") starts.set(s.id, r3(at));
        at += typeof s.dur === "number" && s.dur > 0 ? s.dur : 0;
      }
    } catch {
    }
  }
  const words = flags.has("words");
  const scenes = [];
  const silent = [];
  for (const v of voice.scenes) {
    if (!isObject4(v) || typeof v.id !== "string" || only && !only.has(v.id)) continue;
    const b = sceneBeats(voice, v, { words, maxSeconds: store.maxFilmSeconds, film: starts.get(v.id) ?? null });
    if (b) scenes.push(b);
    else silent.push(v.id);
  }
  const lead = num2(voice.lead, 0, 1, 0.08);
  if (!flags.has("text")) return { root: store.root, lead, scenes, ...silent.length ? { silent } : {} };
  const f2 = (n) => n.toFixed(2);
  const rows = [];
  for (const s of scenes) {
    rows.push(`${s.id}${s.film !== null ? `  film ${f2(s.film)}` : ""}  speech ${f2(s.speech)}  ${s.aligned ? "aligned" : "guessed"}${s.note ? `  (${s.note})` : ""}`);
    for (const l of s.lines) {
      rows.push(`  [${l.i}] ${f2(l.start).padStart(6)} \u2013 ${f2(l.end).padStart(6)}  ${l.text}`);
      if (l.words) rows.push(`        ${l.words.map((w) => `${w.w} ${f2(w.t)}${w.again ? "*" : ""}`).join(" \xB7 ")}`);
    }
  }
  if (silent.length) rows.push(`no lines: ${silent.join(", ")}`);
  if (words && scenes.some((s) => s.lines.some((l) => l.words?.some((w) => w.again)))) rows.push("* said again in its line: kit.when finds the first; kit.beat(c, i, f) with --json's f finds this one");
  return rows.join("\n");
}

import fs16 from "node:fs";
import path15 from "node:path";
var isObject5 = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
var r2 = (n) => Math.round(n * 100) / 100;
var r32 = (n) => Math.round(n * 1e3) / 1e3;
var MAX_STILLS = 120;
function sceneSpans(meta) {
  const out = /* @__PURE__ */ new Map();
  for (const p of Array.isArray(meta.parts) ? meta.parts : []) if (isObject5(p) && typeof p.key === "string" && typeof p.p0 === "number" && typeof p.dur === "number") out.set(p.key, { at: p.p0, dur: p.dur });
  if (out.size) return out;
  const scenes = Array.isArray(meta.scenes) ? meta.scenes : [];
  const chapters = Array.isArray(meta.chapters) ? meta.chapters : [];
  if (scenes.length && scenes.length === chapters.length)
    scenes.forEach((s, i) => {
      const end = i + 1 < chapters.length ? chapters[i + 1].t : Number(meta.duration) || 0;
      if (typeof s.id === "string" && typeof chapters[i].t === "number") out.set(s.id, { at: chapters[i].t, dur: Math.max(0, end - chapters[i].t) });
    });
  return out;
}
function momentsOf(flags, meta) {
  const duration = Number(meta.duration) || 0;
  const spans = sceneSpans(meta);
  const end = (t) => r32(Math.min(Math.max(0, t), Math.max(0, duration - 1e-3)));
  const sceneAt = (s) => {
    const span = spans.get(s);
    if (!span) throw fail("UNKNOWN_SCENE", `${s}: no scene of the film as it plays (it has ${[...spans.keys()].join(", ") || "none the player names"}).`);
    return span;
  };
  const sceneOf = (t) => [...spans].find(([, s]) => t >= s.at && t < s.at + s.dur)?.[0];
  const out = [];
  if (flags.has("every")) {
    const step = positive(flags, "every", 3600);
    for (let t = 0; t < duration && out.length < MAX_STILLS; t += step) out.push({ t: r32(t), asked: `every ${step}` });
  }
  if (flags.has("scenes")) for (const [id, s] of spans) out.push({ t: r32(s.at + s.dur / 2), asked: id, scene: id });
  const at = flags.get("at");
  if (at && at !== "true") {
    for (const raw of at.split(",").map((x) => x.trim()).filter(Boolean)) {
      if (/^-?\d+(\.\d+)?$/.test(raw)) {
        const t = Number(raw);
        if (t < 0 || t > duration) throw fail("INVALID_FLAG", `--at ${raw}: the film runs ${r2(duration)} s.`);
        out.push({ t: end(t), asked: raw });
        continue;
      }
      const m = /^([A-Za-z0-9][A-Za-z0-9_.-]*?)(?:\+(\d+(?:\.\d+)?))?$/.exec(raw);
      if (!m) throw fail("INVALID_FLAG", `--at ${raw}: give seconds (12.5), a scene (s03, its middle) or a time in a scene (s03+1.2).`);
      const s = sceneAt(m[1]);
      const into = m[2] === void 0 ? s.dur / 2 : Number(m[2]);
      if (into > s.dur) throw fail("INVALID_FLAG", `--at ${raw}: ${m[1]} runs ${r2(s.dur)} s as the film plays.`);
      out.push({ t: end(s.at + into), asked: raw, scene: m[1] });
    }
  }
  if (!out.length) throw fail("MISSING_ARGUMENT", "Say which moments: --at 1.5,s03,s03+2.4 (seconds, a scene's middle, a time in a scene), --scenes (each scene's middle) or --every <seconds>.");
  if (out.length > MAX_STILLS) throw fail("INVALID_FLAG", `${out.length} stills asked for; ${MAX_STILLS} at most.`);
  return out.map((m) => ({ ...m, scene: m.scene ?? sceneOf(m.t) })).sort((x, y) => x.t - y.t);
}
async function stillsCommand(store, flags) {
  const type = flags.get("format") ?? "png";
  if (type !== "png" && type !== "jpeg") throw fail("INVALID_FLAG", "--format is png (the default) or jpeg.");
  const width = positive(flags, "width", 7680);
  if (!flags.has("at") && !flags.has("every") && !flags.has("scenes")) momentsOf(flags, {});
  const out = flags.get("out") ? path15.resolve(flags.get("out")) : path15.join(store.root, "exports", "stills");
  const film = await openFilm(store, "stills");
  try {
    const meta = film.meta;
    const moments = momentsOf(flags, meta);
    const full = Number(meta.width) || 1920;
    const scale = Math.min(4, (width ?? Math.min(full, 960)) / full);
    fs16.mkdirSync(out, { recursive: true });
    const before = fs16.readdirSync(out).reduce((n, f) => Math.max(n, Number(/^still-(\d+)-/.exec(f)?.[1] ?? 0)), 0);
    const made = [];
    for (let i = 0; i < moments.length; i++) {
      const m = moments[i];
      const url = await film.page.evaluate(`window.__animation.frame(${m.t}, { scale: ${scale}, type: ${JSON.stringify(`image/${type}`)} })`);
      const comma = typeof url === "string" ? url.indexOf(",") : -1;
      if (comma < 0) throw fail("RENDER_FAILED", `the player drew no frame at ${m.t} s${film.page.problems.length ? `: ${film.page.problems[0].text}` : ""}.`);
      const file = path15.join(out, `still-${String(before + i + 1).padStart(2, "0")}-${m.t.toFixed(2)}s.${type === "jpeg" ? "jpg" : "png"}`);
      fs16.writeFileSync(file, Buffer.from(url.slice(comma + 1), "base64"));
      made.push({ t: m.t, ...m.scene ? { scene: m.scene } : {}, ...m.asked !== String(m.t) ? { asked: m.asked } : {}, file });
    }
    const warnings = [...film.warnings, ...await playWarnings(film)];
    return {
      root: store.root,
      out,
      width: Math.round(full * scale),
      height: Math.round((Number(meta.height) || 1080) * scale),
      duration: r2(Number(meta.duration) || 0),
      stills: made,
      ...warnings.length ? { warnings } : {},
      next: `look at each file of stills (they are the frames the film shows, captions too)${before ? `; the folder's earlier stills, up to ${String(before).padStart(2, "0")}, are an earlier call's` : ""}; they are not part of the film`
    };
  } finally {
    await film.close();
  }
}
var LEVEL_STEP = 0.1;
var DUCK_ATTACK = 0.25;
var DUCK_RELEASE = 0.5;
var QUIET_DB = -30;
var dbfs = (x) => x > 0 ? Math.max(-99, Math.round(200 * Math.log10(x)) / 10) : -99;
var ON_BEAT = 0.02;
function sceneStarts(docs) {
  try {
    const s = JSON.parse(String(docs.get("modules/scenes.json")?.text ?? "null"));
    if (!isObject5(s) || !Array.isArray(s.scenes)) return [];
    const out = [];
    let at = 0;
    for (const sc of s.scenes) {
      if (!isObject5(sc) || typeof sc.id !== "string" || typeof sc.dur !== "number" || !(sc.dur > 0)) return out;
      out.push({ id: sc.id, at });
      at += sc.dur;
    }
    return out;
  } catch {
    return [];
  }
}
var rmsOf = (ws) => Math.sqrt(ws.reduce((s, w) => s + w.rms * w.rms, 0) / Math.max(1, ws.length));
async function scoreCommand(store, flags) {
  const { docs } = store.readAllDocs();
  const hasScore = [...docs.keys()].some((p) => /^modules\/score\.js(~\d+)?$/.test(p));
  let duck = -12;
  try {
    const voice = JSON.parse(String(docs.get("modules/voice.json")?.text ?? "{}"));
    if (isObject5(voice) && typeof voice.duck === "number" && Number.isFinite(voice.duck)) duck = Math.max(-30, Math.min(0, voice.duck));
  } catch {
  }
  const film = await openFilm(store, "score");
  try {
    const meta = film.meta;
    const duration = Number(meta.duration) || 0;
    const report = await film.page.evaluate("window.__animation.scoreReport()");
    const warnings = [...film.warnings, ...await playWarnings(film)];
    const silent = Array.isArray(report.unknown) ? report.unknown : [];
    const beds = Array.isArray(report.beds) ? report.beds : [];
    const playing = beds.filter((b) => b.playing);
    const tempo = isObject5(report.tempo) && report.tempoSet ? report.tempo : null;
    const cuts = tempo ? sceneStarts(docs).slice(1).map((s) => {
      const beat = (s.at - tempo.t0) / (60 / tempo.bpm);
      const off = (beat - Math.round(beat)) * (60 / tempo.bpm);
      return { scene: s.id, at: r32(s.at), beat: r2(beat), bar: `${Math.floor(Math.round(beat) / 4) + 1}.${(Math.round(beat) % 4 + 4) % 4 + 1}`, ...Math.abs(off) > ON_BEAT ? { off: r32(off) } : {} };
    }) : [];
    const offBeat = cuts.filter((c) => "off" in c);
    const marimba = Array.isArray(report.fallback) ? report.fallback : [];
    const out = {
      root: store.root,
      duration: r2(duration),
      events: report.events ?? 0,
      notes: report.notes ?? 0,
      drums: report.drums ?? 0,
      fx: report.fx ?? 0,
      ...silent.length ? { silent } : {},
      ...marimba.length ? { marimba } : {},
      ...isObject5(report.tempo) ? { tempo: { bpm: r2(report.tempo.bpm), t0: r32(report.tempo.t0) } } : {},
      ...report.events ? { sounds: { first: r2(report.first), last: r2(report.last) } } : {},
      ...beds.length ? { beds: beds.map((b) => ({ ...b, at: r2(b.at), ...typeof b.to === "number" ? { to: r2(b.to) } : {}, ...typeof b.file === "number" ? { file: r2(b.file) } : {} })) } : {},
      ...cuts.length ? { cuts } : {}
    };
    if (!report.events && !playing.length) {
      return {
        ...out,
        ...warnings.length ? { warnings } : {},
        next: hasScore ? `modules/score.js plays nothing: its warnings say why (a throw, pitches it could not read${beds.length ? ", a bed whose asset is missing" : ""}), or it never calls kit.score(function (S, T) { \u2026 })` : "the film has no score: modules/score.js, kit.score(function (S, T) { \u2026 }) as claude-motion's sound.md writes S"
      };
    }
    const audio = await film.page.evaluate(`window.__animation.renderAudio({ step: ${LEVEL_STEP} })`);
    for (const blob of [audio?.wav, audio?.mid]) if (typeof blob === "string") await film.page.evaluate(`window.__animation.free(${JSON.stringify(blob)})`).catch(() => {
    });
    const levels = (Array.isArray(audio?.levels) ? audio.levels : []).filter((l) => isObject5(l) && typeof l.t === "number" && typeof l.rms === "number" && l.t < duration);
    const within = (a, b) => levels.filter((l) => l.t >= a - 1e-6 && l.t + LEVEL_STEP <= b + 1e-6);
    const takes = (Array.isArray(meta.voice) ? meta.voice : []).filter((v) => isObject5(v) && (v.state === "take" || v.state === "aligned") && typeof v.at === "number" && typeof v.dur === "number").map((v) => ({ id: String(v.id), a: v.at, b: Math.min(duration, v.at + v.dur) })).sort((x, y) => x.a - y.a);
    const spoken = takes.reduce((s, t) => s + (t.b - t.a), 0);
    const voiceLevel = takes.length ? dbfs(rmsOf(takes.flatMap((t) => within(t.a, t.b)))) : null;
    const gaps = [];
    let from = 0;
    let after;
    for (const t of [...takes, { id: void 0, a: duration, b: duration }]) {
      if (t.a - from >= 0.2) {
        const ws = within(from, t.a);
        const held = after !== void 0 && t.id !== void 0 && t.a - DUCK_ATTACK <= from + DUCK_RELEASE;
        if (ws.length)
          gaps.push({ from: r2(from), to: r2(t.a), ...after ? { after } : {}, ...t.id ? { before: t.id } : {}, music: dbfs(rmsOf(ws)), ...takes.length && held ? { ducked: true } : {} });
      }
      from = Math.max(from, t.b);
      after = t.id;
    }
    const seconds = [];
    for (let s = 0; s < Math.ceil(duration); s++) seconds.push(dbfs(rmsOf(within(s, Math.min(duration, s + 1)))));
    const firstSound = Math.min(report.events ? report.first : Infinity, ...playing.map((b) => b.at));
    const lastSound = Math.max(report.events ? report.last : 0, ...playing.map((b) => typeof b.to === "number" ? b.to : duration));
    const first = Math.max(0, Math.floor(Math.min(firstSound, takes[0]?.a ?? Infinity)));
    const last = Math.min(Math.floor(duration - 1), Math.ceil(Math.max(lastSound, takes.at(-1)?.b ?? 0)));
    const quiet = [];
    for (let s = first; s < last; s++) {
      if (seconds[s] >= QUIET_DB) continue;
      const prev = quiet.at(-1);
      if (prev && prev.to === s) prev.to = s + 1;
      else quiet.push({ from: s, to: s + 1 });
    }
    return {
      ...out,
      loudness: { lufs: Math.round(Number(audio.lufs) * 10) / 10, peak: dbfs(Number(audio.peak)) },
      ...takes.length ? { voice: { takes: takes.length, seconds: r2(spoken), level: voiceLevel, duck } } : {},
      gaps,
      quiet,
      ...flags.has("levels") ? { levels: seconds } : {},
      ...warnings.length ? { warnings } : {},
      read: `levels are RMS dBFS: \u221260 silent, \u221230 a quiet bed, \u221220 a groove, \u221212 a hit (sound.md). voice.level is the voice and the music under it; a gap's music is the music alone, where no take plays${takes.length ? `. ducked: the gap is under ${DUCK_ATTACK + DUCK_RELEASE} s, so the music stays ${-duck} dB down (voice.json's duck) all through it` : ""}. quiet: whole seconds below ${QUIET_DB} between the first sound and the last${flags.has("levels") ? ". levels: one a second from 0" : ""}${beds.length ? ". beds: the recorded music S.bed plays, from at to to (film seconds), file its length" : ""}${cuts.length ? `. cuts: where each scene starts on S.tempo's grid, as a beat from t0 and bar.beat (4 to a bar); off: seconds from the nearest beat, past ${ON_BEAT}` : ""}`,
      next: [
        silent.length ? `silent plays nothing: name each as sound.md does (its drums and its fx), or drop it` : "",
        marimba.length ? `marimba: S.program a patch sound.md names (marimba, vibes, glock, ep, keys, pluck, bass, pad) for those tracks` : "",
        beds.some((b) => !b.playing) ? "a bed that is not playing: its warning says why (no such asset, a file too big, an offset past its end)" : "",
        offBeat.length ? `cuts off the beat: ${offBeat.map((c) => c.scene).join(", ")}; move the scene's start onto a beat (each scene's dur a whole number of beats, ${r32(60 / tempo.bpm)} s each) or the grid (S.tempo's t0)` : "",
        "then listen by these numbers: the music between lines under the voice and above silence, no quiet second the film did not mean"
      ].filter(Boolean).join("; ")
    };
  } finally {
    await film.close();
  }
}
async function captionsCommand(store, flags) {
  const format = flags.get("format") ?? "srt";
  if (format !== "srt" && format !== "vtt") throw fail("INVALID_FLAG", "--format is srt (the default) or vtt.");
  const film = await openFilm(store, "captions");
  try {
    const cues = captionCues(film.meta);
    if (!cues.length) throw fail("NO_CAPTIONS", "The film has no captions: they come from modules/voice.json's lines.");
    const out = flags.get("out") ? path15.resolve(flags.get("out")) : path15.join(store.root, "exports", `captions.${format}`);
    fs16.mkdirSync(path15.dirname(out), { recursive: true });
    fs16.writeFileSync(out, captionFile(cues, format));
    let shown2 = true;
    try {
      const voice = JSON.parse(String(store.readAllDocs().docs.get("modules/voice.json")?.text ?? "{}"));
      shown2 = !(isObject5(voice) && voice.captions === false);
    } catch {
    }
    return {
      root: store.root,
      out,
      captions: cues.length,
      seconds: r2(Number(film.meta.duration) || 0),
      first: cues.slice(0, 3).map((c) => ({ a: r2(c.a), b: r2(c.b), text: c.text })),
      ...shown2 ? {} : { note: 'voice.json has "captions": false, so the film itself shows none; the file has them all the same' },
      ...film.warnings.length ? { warnings: film.warnings } : {}
    };
  } finally {
    await film.close();
  }
}

import fs17 from "node:fs";
import path16 from "node:path";
var r22 = (n) => Math.round(n * 100) / 100;
var r33 = (n) => Math.round(n * 1e3) / 1e3;
var dbfs2 = (x) => x > 0 ? Math.max(-99, Math.round(200 * Math.log10(x)) / 10) : -99;
function decodeWavStereo(b) {
  if (b.length < 12 || b.toString("latin1", 0, 4) !== "RIFF" || b.toString("latin1", 8, 12) !== "WAVE") return null;
  let format = 0;
  let channels = 0;
  let rate = 0;
  let bits = 0;
  for (let at = 12; at + 8 <= b.length; ) {
    const id = b.toString("latin1", at, at + 4);
    let size = b.readUInt32LE(at + 4);
    if (id === "fmt " && at + 24 <= b.length) {
      format = b.readUInt16LE(at + 8);
      channels = b.readUInt16LE(at + 10);
      rate = b.readUInt32LE(at + 12);
      bits = b.readUInt16LE(at + 22);
      if (format === 65534 && at + 34 <= b.length) format = b.readUInt16LE(at + 32);
    }
    if (id === "data") {
      if (!channels || !rate || !bits) return null;
      if (size === 0 || at + 8 + size > b.length) size = b.length - at - 8;
      const bytes = bits / 8;
      const frames = Math.floor(size / (bytes * channels));
      const read = format === 3 && bits === 32 ? (o) => b.readFloatLE(o) : format === 3 && bits === 64 ? (o) => b.readDoubleLE(o) : format === 1 && bits === 16 ? (o) => b.readInt16LE(o) / 32768 : format === 1 && bits === 24 ? (o) => b.readIntLE(o, 3) / 8388608 : format === 1 && bits === 32 ? (o) => b.readInt32LE(o) / 2147483648 : format === 1 && bits === 8 ? (o) => (b[o] - 128) / 128 : null;
      if (!read) return null;
      const left = new Float32Array(frames);
      const right = new Float32Array(frames);
      const start = at + 8;
      for (let f = 0; f < frames; f++) {
        const o = start + f * channels * bytes;
        left[f] = read(o);
        right[f] = channels > 1 ? read(o + bytes) : left[f];
      }
      return { rate, left, right };
    }
    at += 8 + size + (size & 1);
  }
  return null;
}
async function readStereo(file) {
  if (!fs17.existsSync(file)) throw fail("NOT_FOUND", `${file} does not exist.`);
  const bytes = fs17.readFileSync(file);
  const wav = decodeWavStereo(bytes);
  if (wav) return wav;
  if (!findFfmpeg())
    throw fail("NO_FFMPEG", `${path16.basename(file)} is not a wav; this reads a wav itself and anything else through ffmpeg, which is not here. Install ffmpeg (or set FFMPEG_PATH), or convert it to a wav first.`);
  const raw = await ffmpegPipe(["-vn", "-ac", "2", "-ar", "48000", "-f", "f32le"], bytes);
  const all = new Float32Array(raw.buffer, raw.byteOffset, Math.floor(raw.length / 4));
  const frames = Math.floor(all.length / 2);
  const left = new Float32Array(frames);
  const right = new Float32Array(frames);
  for (let f = 0; f < frames; f++) {
    left[f] = all[2 * f];
    right[f] = all[2 * f + 1];
  }
  return { rate: 48e3, left, right };
}
function encodeWavStereo(pcm) {
  const n = pcm.left.length;
  const b = Buffer.alloc(44 + n * 4);
  b.write("RIFF", 0);
  b.writeUInt32LE(36 + n * 4, 4);
  b.write("WAVEfmt ", 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(2, 22);
  b.writeUInt32LE(pcm.rate, 24);
  b.writeUInt32LE(pcm.rate * 4, 28);
  b.writeUInt16LE(4, 32);
  b.writeUInt16LE(16, 34);
  b.write("data", 36);
  b.writeUInt32LE(n * 4, 40);
  const s16 = (v) => Math.max(-32768, Math.min(32767, Math.round(v * 32767)));
  for (let i = 0; i < n; i++) {
    b.writeInt16LE(s16(pcm.left[i]), 44 + i * 4);
    b.writeInt16LE(s16(pcm.right[i]), 46 + i * 4);
  }
  return b;
}
async function writeAudio(file, pcm) {
  const ext = path16.extname(file).toLowerCase();
  const wav = encodeWavStereo(pcm);
  let out;
  if (ext === ".wav") out = wav;
  else if (ext === ".mp3" || ext === ".m4a") {
    if (!findFfmpeg()) throw fail("NO_FFMPEG", `--out ${path16.basename(file)} needs ffmpeg to encode, which is not here: write a .wav (the player plays it; upload takes it).`);
    out = await ffmpegPipe(ext === ".mp3" ? ["-c:a", "libmp3lame", "-b:a", "192k", "-f", "mp3"] : ["-c:a", "aac", "-b:a", "192k", "-movflags", "frag_keyframe+empty_moov", "-f", "mp4"], wav);
  } else throw fail("INVALID_FLAG", `--out is a .wav, .mp3 or .m4a file, not ${path16.basename(file)}.`);
  fs17.mkdirSync(path16.dirname(file), { recursive: true });
  fs17.writeFileSync(file, out);
}
function biquad(x, b0, b1, b2, a1, a2) {
  const y = new Float32Array(x.length);
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1;
    x1 = x[i];
    y2 = y1;
    y1 = v;
    y[i] = v;
  }
  return y;
}
function kWeight(x, rate) {
  let K = Math.tan(Math.PI * 1681.974450955533 / rate);
  const Q = 0.7071752369554196;
  const Vh = Math.pow(10, 3.999843853973347 / 20);
  const Vb = Math.pow(Vh, 0.4996667741545416);
  let a0 = 1 + K / Q + K * K;
  const shelf = biquad(x, (Vh + Vb * K / Q + K * K) / a0, 2 * (K * K - Vh) / a0, (Vh - Vb * K / Q + K * K) / a0, 2 * (K * K - 1) / a0, (1 - K / Q + K * K) / a0);
  K = Math.tan(Math.PI * 38.13547087602444 / rate);
  const Q2 = 0.5003270373238773;
  a0 = 1 + K / Q2 + K * K;
  return biquad(shelf, 1, -2, 1, 2 * (K * K - 1) / a0, (1 - K / Q2 + K * K) / a0);
}
function loudness(pcm) {
  const block = Math.round(0.4 * pcm.rate);
  const hop = Math.round(0.1 * pcm.rate);
  const l = kWeight(pcm.left, pcm.rate);
  const r = kWeight(pcm.right, pcm.rate);
  const energies = [];
  for (let s = 0; s + block <= l.length; s += hop) {
    let e = 0;
    for (let i = s; i < s + block; i++) e += l[i] * l[i] + r[i] * r[i];
    energies.push(e / block);
  }
  const lufs = (e) => -0.691 + 10 * Math.log10(Math.max(e, 1e-12));
  const abs = energies.filter((e) => lufs(e) > -70);
  if (!abs.length) return -Infinity;
  const rel = lufs(abs.reduce((a, b) => a + b, 0) / abs.length) - 10;
  const gated = abs.filter((e) => lufs(e) > rel);
  return lufs(gated.reduce((a, b) => a + b, 0) / Math.max(1, gated.length));
}
function rmsBetween(pcm, a, b) {
  const i0 = Math.max(0, Math.floor(a * pcm.rate));
  const i1 = Math.min(pcm.left.length, Math.floor(b * pcm.rate));
  if (i1 <= i0) return 0;
  let s = 0;
  for (let i = i0; i < i1; i++) s += pcm.left[i] * pcm.left[i] + pcm.right[i] * pcm.right[i];
  return Math.sqrt(s / (2 * (i1 - i0)));
}
function silences(pcm) {
  const win = Math.max(1, Math.round(pcm.rate / 100));
  const n = Math.floor(pcm.left.length / win);
  const loud = (w) => rmsBetween(pcm, w * win / pcm.rate, (w + 1) * win / pcm.rate) > Math.pow(10, -45 / 20);
  let first = 0;
  while (first < n && !loud(first)) first++;
  let last = n - 1;
  while (last > first && !loud(last)) last--;
  return { lead: first * win / pcm.rate, tail: first >= n ? 0 : Math.max(0, pcm.left.length / pcm.rate - (last + 1) * win / pcm.rate) };
}
function onsets(pcm, hop = 0.01) {
  const mono = new Float32Array(pcm.left.length);
  for (let i = 0; i < mono.length; i++) mono[i] = (pcm.left[i] + pcm.right[i]) / 2;
  const k = Math.exp(-2 * Math.PI * 200 / pcm.rate);
  const low = new Float32Array(mono.length);
  let y = 0;
  for (let i = 0; i < mono.length; i++) low[i] = y = (1 - k) * mono[i] + k * y;
  const win = Math.max(1, Math.round(hop * pcm.rate));
  const n = Math.floor(mono.length / win);
  const o = new Float32Array(n);
  let prevL = 0;
  let prevH = 0;
  for (let w = 0; w < n; w++) {
    let el = 0;
    let eh = 0;
    for (let i = w * win; i < (w + 1) * win; i++) {
      el += low[i] * low[i];
      const h = mono[i] - low[i];
      eh += h * h;
    }
    const L = Math.log10(1e-9 + el / win);
    const H = Math.log10(1e-9 + eh / win);
    o[w] = Math.max(0, L - prevL) + Math.max(0, H - prevH);
    prevL = L;
    prevH = H;
  }
  return { hop: win / pcm.rate, o };
}
function estimateTempo(o, hop) {
  const mean = o.reduce((a2, b2) => a2 + b2, 0) / Math.max(1, o.length);
  const c = o.map((v) => v - mean);
  const minLag = Math.floor(60 / 200 / hop);
  const maxLag = Math.ceil(60 / 60 / hop);
  if (c.length < maxLag * 4) return null;
  const scores = [];
  for (let lag2 = minLag; lag2 <= maxLag; lag2++) {
    let s = 0;
    for (let i = lag2; i < c.length; i++) s += c[i] * c[i - lag2];
    s /= c.length - lag2;
    const bpm = 60 / (lag2 * hop);
    const lean = Math.exp(-0.5 * Math.pow(Math.log2(bpm / 120) / 0.9, 2));
    scores.push({ lag: lag2, s: s * lean });
  }
  scores.sort((a2, b2) => b2.s - a2.s);
  const best = scores[0];
  if (!(best.s > 0)) return null;
  const at = (lag2) => scores.find((x) => x.lag === lag2)?.s ?? best.s;
  const a = at(best.lag - 1);
  const b = at(best.lag + 1);
  const shift = a - 2 * best.s + b === 0 ? 0 : 0.5 * (a - b) / (a - 2 * best.s + b);
  const lag = best.lag + Math.max(-0.5, Math.min(0.5, shift));
  const rest = scores.filter((x) => Math.abs(x.lag - best.lag) > 2 && Math.abs(x.lag - 2 * best.lag) > 2 && Math.abs(2 * x.lag - best.lag) > 2);
  const sure = rest.length ? Math.max(0, Math.min(1, 1 - rest[0].s / best.s)) : 1;
  return { bpm: 60 / (lag * hop), sure };
}
function beatPhase(o, hop, bpm) {
  const beat = 60 / bpm;
  const steps = Math.max(1, Math.round(beat / hop));
  let best = 0;
  let bestS = -1;
  for (let p = 0; p < steps; p++) {
    let s = 0;
    for (let t = p * hop; t / hop < o.length; t += beat) {
      const i = Math.round(t / hop);
      s += (o[i] ?? 0) + 0.5 * ((o[i - 1] ?? 0) + (o[i + 1] ?? 0));
    }
    if (s > bestS) {
      bestS = s;
      best = p * hop;
    }
  }
  return best;
}
async function musicCommand(file, flags) {
  if (!file) throw fail("MISSING_FILE", "Give the music file: music <file> [--bpm n] [--step s].");
  const pcm = await readStereo(path16.resolve(file));
  const seconds = pcm.left.length / pcm.rate;
  if (seconds < 0.5) throw fail("TOO_SHORT", `${file} holds ${r22(seconds)} s of sound: too little to measure.`);
  const step = flags.has("step") ? Number(flags.get("step")) : 4;
  if (!Number.isFinite(step) || step < 0.5 || step > 60) throw fail("INVALID_FLAG", "--step is seconds, 0.5 to 60.");
  const given = flags.has("bpm") ? Number(flags.get("bpm")) : void 0;
  if (given !== void 0 && !(given >= 20 && given <= 300)) throw fail("INVALID_FLAG", "--bpm is 20 to 300.");
  let peak = 0;
  for (let i = 0; i < pcm.left.length; i++) peak = Math.max(peak, Math.abs(pcm.left[i]), Math.abs(pcm.right[i]));
  const { lead, tail } = silences(pcm);
  const { hop, o } = onsets(pcm);
  const est = given === void 0 ? estimateTempo(o, hop) : null;
  const bpm = given ?? est?.bpm;
  const sections = [];
  for (let a = 0; a < seconds - 1e-6; a += step) {
    const b = Math.min(seconds, a + step);
    sections.push({ from: r22(a), to: r22(b), level: dbfs2(rmsBetween(pcm, a, b)) });
  }
  const top = Math.max(...sections.map((s) => s.level));
  for (const s of sections) if (s.level >= top - 3) s.loudest = true;
  let tempo;
  if (bpm) {
    const t0 = beatPhase(o, hop, bpm);
    const beat = 60 / bpm;
    tempo = {
      bpm: Math.round(bpm * 10) / 10,
      ...est ? { estimated: true, sure: r22(est.sure) } : {},
      t0: r33(t0),
      beat: r33(beat),
      bar: r33(beat * 4),
      beats: Math.floor((seconds - t0) / beat + 1e-6)
    };
  }
  return {
    file: path16.resolve(file),
    seconds: r22(seconds),
    rate: pcm.rate,
    lead: r22(lead),
    tail: r22(tail),
    loudness: { lufs: Math.round(loudness(pcm) * 10) / 10, peak: dbfs2(peak) },
    ...tempo ? { tempo } : {},
    sections,
    read: `lead and tail: seconds of near silence at the start and the end. tempo.t0: where the first beat falls in the file; arrange counts bars of 4 beats from it, so when the bar's first beat is a later one, give arrange that beat's time as --t0${est ? "; the tempo is estimated from the onsets: trust it when sure is high and it matches what was asked for, else give --bpm" : ""}. sections: RMS dBFS every ${step} s (\u221230 a quiet bed, \u221220 a groove, \u221212 loud); loudest: within 3 dB of the loudest`,
    next: "compare with what was asked for: the length, a first beat at once (lead near 0), the tempo, the build where it was meant to be; then S.bed it, or arrange it to the cut first"
  };
}
function readMap(given) {
  const text = given === "-" ? fs17.readFileSync(0, "utf8") : given.trim().startsWith("[") || given.trim().startsWith("{") ? given : fs17.existsSync(given) ? fs17.readFileSync(given, "utf8") : null;
  if (text === null) throw fail("NOT_FOUND", `--map ${given} is no file (or inline JSON).`);
  try {
    return JSON.parse(text);
  } catch (e) {
    throw fail("INVALID_MAP", `--map is not JSON: ${e.message}`);
  }
}
async function arrangeCommand(flags) {
  const input = flags.get("in");
  if (!input || input === "true") throw fail("MISSING_FLAG", "Give the track: arrange --in <music> --bpm n [--t0 s] --map <map.json> [--out bed.wav].");
  const bpm = Number(flags.get("bpm"));
  if (!(bpm >= 20 && bpm <= 300)) throw fail("INVALID_FLAG", "--bpm is the track's tempo, 20 to 300 (music <file> estimates it).");
  const t0 = flags.has("t0") ? Number(flags.get("t0")) : 0;
  if (!Number.isFinite(t0)) throw fail("INVALID_FLAG", "--t0 is seconds: where the track's first beat falls.");
  const perBar = flags.has("beats-per-bar") ? Number(flags.get("beats-per-bar")) : 4;
  if (!(Number.isInteger(perBar) && perBar >= 1 && perBar <= 16)) throw fail("INVALID_FLAG", "--beats-per-bar is a whole number, 1 to 16.");
  const xfade = flags.has("xfade") ? Number(flags.get("xfade")) : 0.03;
  if (!(xfade >= 0 && xfade <= 2)) throw fail("INVALID_FLAG", "--xfade is seconds, 0 to 2.");
  const fadeOut = flags.has("fade-out") ? Number(flags.get("fade-out")) : 1;
  if (!(fadeOut >= 0 && fadeOut <= 30)) throw fail("INVALID_FLAG", "--fade-out is seconds, 0 to 30.");
  const mapGiven = flags.get("map");
  if (!mapGiven || mapGiven === "true") throw fail("MISSING_FLAG", '--map: a JSON array of pieces, [{"at": 0, "bar": 1, "bars": 8}, {"at": 16, "bar": 17, "bars": 4}, \u2026].');
  const raw = readMap(mapGiven);
  const list = Array.isArray(raw) ? raw : raw && typeof raw === "object" && Array.isArray(raw.pieces) ? raw.pieces : null;
  if (!list || !list.length) throw fail("INVALID_MAP", "--map is a non-empty JSON array of pieces.");
  const beat = 60 / bpm;
  const pieces = [];
  let end = 0;
  list.forEach((p, i) => {
    const where = `--map piece ${i + 1}`;
    if (!p || typeof p !== "object") throw fail("INVALID_MAP", `${where} is not an object.`);
    const q = p;
    const at = q.at === void 0 ? end : Number(q.at);
    const from = q.bar !== void 0 ? t0 + (Number(q.bar) - 1) * perBar * beat : q.beat !== void 0 ? t0 + Number(q.beat) * beat : q.from !== void 0 ? Number(q.from) : NaN;
    const len = q.bars !== void 0 ? Number(q.bars) * perBar * beat : q.beats !== void 0 ? Number(q.beats) * beat : q.dur !== void 0 ? Number(q.dur) : NaN;
    if (!Number.isFinite(at) || at < 0) throw fail("INVALID_MAP", `${where}: "at" is film seconds, 0 or more (left out: where the piece before ends).`);
    if (!Number.isFinite(from)) throw fail("INVALID_MAP", `${where} needs where it starts in the track: "bar" (from 1), "beat" (from 0) or "from" (seconds).`);
    if (!(len > 0)) throw fail("INVALID_MAP", `${where} needs how long it is: "bars", "beats" or "dur" (seconds), above 0.`);
    pieces.push({ at, from, len });
    end = at + len;
  });
  const src = await readStereo(path16.resolve(input));
  const rate = src.rate;
  const total = flags.has("length") ? Number(flags.get("length")) : Math.max(...pieces.map((p) => p.at + p.len));
  if (!(total > 0 && total <= 3600)) throw fail("INVALID_FLAG", "--length is seconds, above 0, 3600 at most.");
  const n = Math.round(total * rate);
  const out = { rate, left: new Float32Array(n), right: new Float32Array(n) };
  const srcSeconds = src.left.length / rate;
  const warnings = [];
  const sorted2 = [...pieces].sort((a, b) => a.at - b.at);
  const half = xfade / 2;
  sorted2.forEach((p, i) => {
    const prev = sorted2[i - 1];
    const next = sorted2[i + 1];
    if (p.from < -1e-6 || p.from + p.len > srcSeconds + 1e-3)
      warnings.push(`the piece at ${r22(p.at)} s reads ${r22(p.from)} to ${r22(p.from + p.len)} s of the track, which runs ${r22(srcSeconds)} s: what lies outside is silence.`);
    if (prev && p.at > prev.at + prev.len + 0.01) warnings.push(`${r22(prev.at + prev.len)} to ${r22(p.at)} s: no piece plays there, so it is silent.`);
    if (prev && p.at < prev.at + prev.len - 0.01) warnings.push(`the piece at ${r22(p.at)} s starts before the one at ${r22(prev.at)} s ends (${r22(prev.at + prev.len)} s): it cuts that one short.`);
    const joinsIn = !!prev && p.at <= prev.at + prev.len + 0.01;
    const stop2 = next ? Math.min(p.at + p.len, next.at) : Math.min(p.at + p.len, total);
    const joinsOut = !!next && next.at <= p.at + p.len + 0.01;
    const a = joinsIn && half > 0 ? p.at - half : p.at;
    const b = joinsOut && half > 0 ? stop2 + half : stop2;
    const ia = Math.max(0, Math.round(a * rate));
    const ib = Math.min(n, Math.round(b * rate));
    const finalFade = !next && fadeOut > 0 ? Math.min(fadeOut, stop2 - p.at) : 0;
    for (let k = ia; k < ib; k++) {
      const t = k / rate;
      const s = Math.round((p.from + (t - p.at)) * rate);
      if (s < 0 || s >= src.left.length) continue;
      let g = 1;
      if (joinsIn && half > 0 && t < p.at + half) g *= Math.sin(Math.PI / 2 * Math.max(0, Math.min(1, (t - (p.at - half)) / xfade)));
      if (joinsOut && half > 0 && t > stop2 - half) g *= Math.cos(Math.PI / 2 * Math.max(0, Math.min(1, (t - (stop2 - half)) / xfade)));
      if (finalFade > 0 && t > stop2 - finalFade) g *= Math.max(0, (stop2 - t) / finalFade);
      out.left[k] += src.left[s] * g;
      out.right[k] += src.right[s] * g;
    }
  });
  const file = path16.resolve(flags.get("out") && flags.get("out") !== "true" ? flags.get("out") : path16.join(path16.dirname(path16.resolve(input)), `${path16.basename(input, path16.extname(input))}-arranged.wav`));
  await writeAudio(file, out);
  const beatOf = (t) => r22((t - t0) / beat);
  return {
    out: file,
    seconds: r22(total),
    bpm,
    pieces: sorted2.map((p) => ({ at: r33(p.at), to: r33(p.at + p.len), from: r33(p.from), bar: r22((p.from - t0) / (perBar * beat) + 1), beat: beatOf(p.from) })),
    ...warnings.length ? { warnings } : {},
    next: `upload it (upload <root> ${path16.basename(file)}), write assets/${path16.basename(file)} from its reply, then S.bed('${path16.basename(file)}') in score.js, with S.tempo(${bpm}, {t0: 0}) when the first piece starts on a beat at 0; music ${path16.basename(file)} measures it`
  };
}

import { spawnSync as spawnSync2 } from "node:child_process";
import fs18 from "node:fs";
import os9 from "node:os";
import path17 from "node:path";
var isObject6 = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
var r34 = (n) => Math.round(n * 1e3) / 1e3;
var sleep3 = (ms) => new Promise((r) => setTimeout(r, ms));
var STEPS = 'a JSON list of {"wait": s}, {"click": "<css>" | [x, y]}, {"move": [x, y]}, {"type": "<text>", "cps": 14}, {"key": "Enter"}';
var KEYS = {
  Enter: { code: "Enter", vk: 13, text: "\r" },
  Tab: { code: "Tab", vk: 9 },
  Escape: { code: "Escape", vk: 27 },
  Backspace: { code: "Backspace", vk: 8 }
};
function readSteps(file) {
  if (!file) return [];
  let steps;
  try {
    steps = JSON.parse(fs18.readFileSync(file, "utf8"));
  } catch (error) {
    throw fail("INVALID_FLAG", `--steps ${file}: ${error.message}. It is ${STEPS}.`);
  }
  if (!Array.isArray(steps) || !steps.every(isObject6)) throw fail("INVALID_FLAG", `--steps ${file} is ${STEPS}.`);
  return steps;
}
function jpegSize(b) {
  let i = 2;
  while (i + 9 < b.length && b[i] === 255) {
    const m = b[i + 1];
    if (m >= 192 && m <= 195) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)];
    i += 2 + b.readUInt16BE(i + 2);
  }
  return null;
}
async function clickPoint(page, target) {
  if (Array.isArray(target) && target.length === 2 && target.every((n) => typeof n === "number")) return target;
  if (typeof target !== "string") throw fail("INVALID_FLAG", `A click is a CSS selector or [x, y], not ${JSON.stringify(target)}.`);
  const at = await page.evaluate(`(() => { const e = document.querySelector(${JSON.stringify(target)}); if (!e) return null; const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`);
  if (!at) throw fail("STEP_FAILED", `click: nothing on the page matches ${target}.`);
  return at;
}
async function recordCommand(flags) {
  const url = flags.get("url");
  if (!url || !/^(https?|file):/.test(url)) throw fail("INVALID_FLAG", "record --url <the page, http, https or file> --out <clip.mp4> [--steps steps.json] [--size 1440x900] [--scale 2] [--tail s]");
  const given = flags.get("out");
  if (!given) throw fail("INVALID_FLAG", "record needs --out <clip.mp4>.");
  const out = path17.resolve(given);
  const steps = readSteps(flags.get("steps"));
  const size = /^(\d{2,4})x(\d{2,4})$/.exec(flags.get("size") ?? "1440x900");
  if (!size) throw fail("INVALID_FLAG", "--size is <width>x<height>, such as 1440x900.");
  const scale = Number(flags.get("scale") ?? 2);
  const tail = Number(flags.get("tail") ?? 1);
  if (!(scale >= 1 && scale <= 3) || !(tail >= 0)) throw fail("INVALID_FLAG", "--scale is 1 to 3, --tail is seconds.");
  const chrome = findChrome();
  if (!chrome) throw fail("NO_CHROME", "No Chrome here to record with: install Google Chrome (or Chromium, Edge, Brave), or set CHROME_PATH to its program.");
  const ffmpeg = findFfmpeg();
  if (!ffmpeg) throw fail("NO_FFMPEG", "record makes its clip with ffmpeg, which is not on the PATH (or set FFMPEG_PATH).");
  const [width, height] = [Number(size[1]), Number(size[2])];
  const dir = fs18.mkdtempSync(path17.join(os9.tmpdir(), "claude-motion-record-"));
  const browser = await launchChrome(chrome, [`--force-device-scale-factor=${scale}`]);
  try {
    const page = await browser.page();
    await page.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: scale, mobile: false });
    await page.navigate(url);
    await sleep3(Number(flags.get("settle") ?? 800));
    const frames = [];
    page.onEvent("Page.screencastFrame", (p) => {
      const file = path17.join(dir, `${String(frames.length).padStart(6, "0")}.jpg`);
      fs18.writeFileSync(file, Buffer.from(p.data, "base64"));
      frames.push({ file, ts: p.metadata.timestamp });
      void page.send("Page.screencastFrameAck", { sessionId: p.sessionId }).catch(() => {
      });
    });
    const started = Date.now();
    await page.send("Page.startScreencast", { format: "jpeg", quality: 90, maxWidth: width * scale, maxHeight: height * scale, everyNthFrame: 1 });
    await sleep3(300);
    const log3 = [];
    const now = () => r34((Date.now() - started) / 1e3);
    for (const [i, s] of steps.entries()) {
      if (typeof s.wait === "number") await sleep3(s.wait * 1e3);
      else if (s.click !== void 0) {
        const [x, y] = await clickPoint(page, s.click);
        await page.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
        await sleep3(120);
        log3.push({ i, click: [Math.round(x), Math.round(y)], t: now() });
        await page.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
        await page.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
        await sleep3(120);
      } else if (Array.isArray(s.move)) {
        await page.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: s.move[0], y: s.move[1] });
      } else if (typeof s.type === "string") {
        const t0 = now();
        for (const ch of s.type) {
          await page.send("Input.dispatchKeyEvent", { type: "char", text: ch });
          await sleep3(1e3 / (Number(s.cps) || 14));
        }
        log3.push({ i, type: s.type, t: t0, end: now() });
      } else if (typeof s.key === "string") {
        const k = KEYS[s.key];
        if (!k) throw fail("STEP_FAILED", `key: ${s.key}; ${Object.keys(KEYS).join(", ")} are known.`);
        log3.push({ i, key: s.key, t: now() });
        const base3 = { key: s.key, code: k.code, windowsVirtualKeyCode: k.vk, nativeVirtualKeyCode: k.vk };
        await page.send("Input.dispatchKeyEvent", { type: "keyDown", ...base3, ...k.text ? { text: k.text } : {} });
        await page.send("Input.dispatchKeyEvent", { type: "keyUp", ...base3 });
      } else throw fail("STEP_FAILED", `step ${i}: ${JSON.stringify(s)} is none of ${STEPS}.`);
    }
    await sleep3(tail * 1e3);
    const dur = (Date.now() - started) / 1e3;
    await page.send("Page.stopScreencast");
    await sleep3(150);
    if (!frames.length) throw fail("STEP_FAILED", "The page sent no frames.");
    const base2 = frames[0].ts;
    const lead = Math.max(0, base2 - started / 1e3);
    for (const step of log3) {
      step.t = r34(Math.max(0, step.t - lead));
      if (step.end !== void 0) step.end = r34(Math.max(0, step.end - lead));
    }
    let list = "";
    frames.forEach((f, i) => {
      const next = i + 1 < frames.length ? frames[i + 1].ts - base2 : Math.max(dur - lead, f.ts - base2 + 1 / 30);
      list += `file '${f.file}'
duration ${Math.max(next - (f.ts - base2), 1 / 120).toFixed(4)}
`;
    });
    list += `file '${frames.at(-1).file}'
`;
    const listFile = path17.join(dir, "list.txt");
    fs18.writeFileSync(listFile, list);
    fs18.mkdirSync(path17.dirname(out), { recursive: true });
    const encode = spawnSync2(ffmpeg, ["-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", listFile, "-vf", "fps=30,pad=ceil(iw/2)*2:ceil(ih/2)*2", "-c:v", "libx264", "-crf", "20", "-preset", "veryfast", "-g", "15", "-keyint_min", "15", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an", out], { encoding: "utf8" });
    if (encode.status !== 0) throw fail("ENCODE_FAILED", `ffmpeg: ${encode.stderr.trim().slice(-400)}`);
    const [w, h] = jpegSize(fs18.readFileSync(frames.at(-1).file)) ?? [width * scale, height * scale];
    return { out, seconds: r34(dur - lead), width: w + w % 2, height: h + h % 2, frames: frames.length, steps: log3, problems: page.problems.slice(0, 5), next: `upload <root> ${out}` };
  } finally {
    await browser.close();
    fs18.rmSync(dir, { recursive: true, force: true });
  }
}

var SCRIPT = fileURLToPath(import.meta.url);
var SKILL_DIR = path18.dirname(path18.dirname(SCRIPT));
var EDITOR_DIR = path18.join(path18.dirname(SCRIPT), "editor");
var MAX_DOC_BYTES = 204800;
var MAX_COLLECTION_BYTES = 2097152;
var MAX_MODULES = 48;
var MAX_ASSETS = 96;
var MAX_TITLE = 120;
var MAX_SCENES = FILM_MAX_SCENES;
var MAX_SECONDS = FILM_MAX_SECONDS;
var MAX_BATCH_WRITES = 50;
var MAX_BATCH_BYTES = 1024 * 1024;
var MAX_UPLOAD_BYTES = 64 * 1024 * 1024;
var SEGMENT = /^(?!\.\.?$)[A-Za-z0-9_\-.~:@+]{1,200}$/;
var FILM_NAME = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/;
var MODULE_NAME = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}(~[1-9][0-9]?)?$/;
var SCENE_ID = /^[a-z][a-z0-9-]{0,31}$/;
var RESERVED = /* @__PURE__ */ new Set(["__proto__", "constructor", "prototype", "toString", "valueOf", "hasOwnProperty"]);
var BLOB_URL = /^\/?_blob\/([0-9a-f]{32})$/;
var BLOB_ID = /^[0-9a-f]{32}$/;
var DATA_URI = /^data:(image\/(png|jpeg|gif|webp|svg\+xml)|font\/(woff2|woff|ttf|otf)|video\/(mp4|webm)|audio\/(mpeg|wav));base64,[A-Za-z0-9+/=]+$/;
var MODULE_KINDS = ["js", "css", "html", "json", "text"];
var ASSET_MIMES = ["image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml", "font/woff2", "font/woff", "font/ttf", "font/otf", "video/mp4", "video/webm", "application/pdf", "audio/mpeg", "audio/wav"];
var REPLACE_ONLY_DOCS = /* @__PURE__ */ new Set(["modules/fetched-fonts.json", "modules/recolored.json", "modules/retouched.json", "modules/retyped.json"]);
var UNSPLIT_MODULES = ["edits.json", "fetched-fonts.json", "recolored.json", "recut.json", "refaced.json", "retouched.json", "retyped.json", "tweaks.json"];
var CONTENT_TYPES = {
  html: "text/html; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  css: "text/css; charset=utf-8",
  json: "application/json; charset=utf-8",
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  woff2: "font/woff2",
  woff: "font/woff",
  ttf: "font/ttf",
  otf: "font/otf",
  mp4: "video/mp4",
  webm: "video/webm",
  mp3: "audio/mpeg",
  wav: "audio/wav"
};
var CliError = class extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
};
var isObject7 = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
function storeBytes(value) {
  const text = JSON.stringify(value) ?? "";
  return Buffer.byteLength(text, "utf8") + 5 * (text.match(/[<>&]/g)?.length ?? 0) + 3 * (text.match(/[\u2028\u2029]/g)?.length ?? 0);
}
var kib = (n) => n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(2)} MiB` : `${(n / 1024).toFixed(1)} KiB`;
var extOf = (name) => path18.extname(name).slice(1).toLowerCase();
var contentTypeOf = (name) => CONTENT_TYPES[extOf(name)] ?? "application/octet-stream";
var quote = (s) => /^[A-Za-z0-9_./:@%+=-]+$/.test(s) ? s : `'${s.replace(/'/g, `'\\''`)}'`;
var cmd = (name, ...args) => ["node", quote(SCRIPT), name, ...args.map(quote)].join(" ");
function print(value, compact = false) {
  process.stdout.write(`${compact ? JSON.stringify(value) : JSON.stringify(value, null, 2)}
`);
}
var BARE_FLAGS = ["text", "json", "wait", "all", "resolve", "reopen", "lan", "off", "force", "dry-run", "supersample", "words", "scenes", "providers", "audio-only", "no-video"];
function parseArgs(argv) {
  const positional = [];
  const flags = /* @__PURE__ */ new Map();
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const eq = arg.indexOf("=");
      if (eq > 0) flags.set(arg.slice(2, eq), arg.slice(eq + 1));
      else if (i + 1 < argv.length && !argv[i + 1].startsWith("--") && !BARE_FLAGS.includes(arg.slice(2))) flags.set(arg.slice(2), argv[++i]);
      else flags.set(arg.slice(2), "true");
    } else positional.push(arg);
  }
  return { positional, flags };
}
function writeFileAtomic(file, data) {
  fs19.mkdirSync(path18.dirname(file), { recursive: true });
  const tmp = path18.join(path18.dirname(file), `.tmp-${process.pid}-${Date.now()}-${path18.basename(file)}`);
  fs19.writeFileSync(tmp, data);
  fs19.renameSync(tmp, file);
}
function resolveRoot(given, { create = false } = {}) {
  if (!given) throw new CliError("MISSING_ROOT", "Give the film folder (for example designs/<slug>).");
  const root = path18.resolve(given);
  const stat = fs19.statSync(root, { throwIfNoEntry: false });
  if (stat && !stat.isDirectory()) throw new CliError("NOT_A_FOLDER", `${given} is a file; the film is a folder.`);
  if (!stat) {
    if (!create) throw new CliError("NOT_FOUND", `${root} does not exist. Write the film first: ${cmd("write-db", given, "batch.json")}.`);
    fs19.mkdirSync(root, { recursive: true });
  }
  return root;
}
function splitPath(p, what) {
  const clean = String(p ?? "").replace(/^\/+|\/+$/g, "");
  const segs = clean === "" ? [] : clean.split("/");
  if (segs.length === 0 || segs.length > 16 || !segs.every((s) => SEGMENT.test(s))) {
    throw new CliError("INVALID_PATH", `${JSON.stringify(p)} is not a ${what} path: "/"-separated segments of letters, digits and _ - . ~ : @ +.`);
  }
  return segs;
}
function docSegments(p) {
  const segs = splitPath(p, "document");
  if (segs.length % 2 !== 0) throw new CliError("INVALID_PATH", `${p} names a collection; a document path is collection/doc_id (for example modules/scene-pour.js).`);
  return segs;
}
var docFile = (root, segs) => path18.join(root, "db", ...segs.slice(0, -1), `${segs.at(-1)}.json`);
function listDocFiles(root) {
  const out = /* @__PURE__ */ new Map();
  const base2 = path18.join(root, "db");
  const walk = (dir, rel) => {
    let entries;
    try {
      entries = fs19.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.name.startsWith(".")) continue;
      const full = path18.join(dir, e.name);
      if (e.isDirectory()) walk(full, [...rel, e.name]);
      else if (e.isFile() && e.name.endsWith(".json")) {
        const segs = [...rel, e.name.slice(0, -5)];
        if (segs.length % 2 !== 0 || !segs.every((s) => SEGMENT.test(s))) continue;
        out.set(segs.join("/"), { file: full });
      }
    }
  };
  walk(base2, []);
  return out;
}
function readDoc(root, p) {
  const segs = docSegments(p);
  const file = docFile(root, segs);
  let text;
  try {
    text = fs19.readFileSync(file, "utf8");
  } catch {
    return { path: segs.join("/"), exists: false, file };
  }
  try {
    const data = JSON.parse(text);
    if (!isObject7(data)) throw new Error("not an object");
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
      const data = JSON.parse(fs19.readFileSync(file, "utf8"));
      if (isObject7(data)) docs.set(p, data);
      else damaged.push(p);
    } catch {
      damaged.push(p);
    }
  }
  return { docs, damaged };
}
var isDeleteMarker = (v) => v === null || isObject7(v) && v.__delete__ === true && Object.keys(v).length === 1;
function mergePatch(target, patch) {
  const out = isObject7(target) ? { ...target } : {};
  for (const [k, v] of Object.entries(patch)) {
    if (k === "__proto__") continue;
    if (isDeleteMarker(v)) delete out[k];
    else if (isObject7(v)) out[k] = mergePatch(out[k], v);
    else out[k] = v;
  }
  return out;
}
function hasDeleteMarker(v) {
  if (Array.isArray(v)) return v.some(hasDeleteMarker);
  if (!isObject7(v)) return false;
  if (v.__delete__ === true) return true;
  return Object.values(v).some(hasDeleteMarker);
}
function documentProblem(root, segs, data) {
  const p = segs.join("/");
  const bytes = storeBytes(data);
  if (bytes > MAX_DOC_BYTES) return `${p} would be ${kib(bytes)}; the store refuses a document over 200 KiB. Split a module as name~1 \u2026 name~n (joined in order on read).`;
  if (segs.length !== 2) return null;
  const [collection, id] = segs;
  if (collection === "film") {
    if (id === "meta") {
      if (typeof data.title !== "string" || !data.title.trim()) return 'film/meta needs {"v":1, "title":"\u2026", "updatedAt":"\u2026"}: the title is what the user calls the film.';
      if (Array.from(data.title).length > MAX_TITLE) return `film/meta: the title is over ${MAX_TITLE} characters.`;
    } else if (id === "script") {
      if (typeof data.code !== "string") return 'film/script needs {"code":"\u2026"}: the cut, a JavaScript program that sets window.CUT.';
    }
  } else if (collection === "modules") {
    if (!MODULE_NAME.test(id) || RESERVED.has(id)) return `modules/${id}: a module name is a letter or digit, then up to 63 of A\u2013Z a\u2013z 0\u20139 _ . - (a part of a split module ends ~1 \u2026 ~99); the player drops any other.`;
    if (typeof data.text !== "string") return `modules/${id} needs {"kind":"css"|"html"|"js"|"json"|"text", "text":"\u2026"}.`;
    if (data.kind !== void 0 && !MODULE_KINDS.includes(String(data.kind))) return `modules/${id}: kind ${JSON.stringify(data.kind)} is not one of ${MODULE_KINDS.join(", ")}.`;
    const split = /^(.*)~[1-9][0-9]?$/.exec(id);
    if (split && UNSPLIT_MODULES.includes(split[1])) return `modules/${id}: ${split[1]} is the page's own and is never split.`;
  } else if (collection === "assets") {
    if (!FILM_NAME.test(id) || RESERVED.has(id)) return `assets/${id}: an asset name is a letter or digit, then up to 63 of A\u2013Z a\u2013z 0\u20139 _ . -; the player drops any other.`;
    const mime = String(data.mime ?? "");
    if (!ASSET_MIMES.includes(mime)) return `assets/${id}: mime ${JSON.stringify(data.mime)} is not one the player reads (${ASSET_MIMES.join(", ")}); it would drop the asset. Use the upload reply's content_type, verbatim.`;
    const ref = String(data.ref ?? "");
    const blob = BLOB_URL.exec(ref);
    if (blob) {
      if (mime === "image/svg+xml") return `assets/${id}: an SVG is never uploaded; put its <svg> markup in an html module, or a data:image/svg+xml;base64,\u2026 ref.`;
      if (!fs19.existsSync(blobFile(root, blob[1]))) return `assets/${id}: ${ref} is not in this film's _blobs/. Upload the file first (${cmd("upload", root, "<file>")}) and use the url it prints.`;
    } else if (ref.startsWith("data:")) {
      if (mime.startsWith("audio/")) return `assets/${id}: the player plays no audio stored inside the film's data (a data: ref). Upload the file (${cmd("upload", root, "<file>")}) and use the url it prints.`;
      if (!DATA_URI.test(ref)) return `assets/${id}: the data: ref is not data:<image, font, video or audio type>;base64,\u2026; the player drops it.`;
      if (!ref.startsWith(`data:${mime};`)) return `assets/${id}: mime ${mime} does not match the data: URI's own type (${ref.slice(5, ref.indexOf(";"))}).`;
    } else return `assets/${id}: ref must be this film's own /_blob/<32 hex> (from upload) or a small data:\u2026;base64, URI; never an external URL.`;
    for (const k of ["w", "h"]) {
      if (data[k] !== void 0 && (typeof data[k] !== "number" || !Number.isFinite(data[k]) || data[k] < 1)) return `assets/${id}: ${k} is a number of pixels (optional).`;
    }
  }
  return null;
}
function resolveFileRefs(value, where) {
  if (Array.isArray(value)) return value.map((v, i) => resolveFileRefs(v, `${where}[${i}]`));
  if (!isObject7(value)) return value;
  const keys = Object.keys(value);
  if (keys.length === 1 && keys[0] === "$file") {
    const file = path18.resolve(String(value.$file));
    try {
      return fs19.readFileSync(file, "utf8");
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
    if (!isObject7(w)) throw new CliError("INVALID_WRITE", `${where} is not an object.`);
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
    if (seen.has(p)) throw new CliError("DUPLICATE_DOCUMENT", `${where}: ${p} appears twice; address each document once per batch.`);
    seen.add(p);
    let data;
    if (op !== "delete") {
      if (w.data === void 0 === (w.file_path === void 0)) throw new CliError("INVALID_WRITE", `${where} (${op}) needs exactly one of "data" or "file_path".`);
      if (w.file_path !== void 0) {
        try {
          data = JSON.parse(fs19.readFileSync(path18.resolve(String(w.file_path)), "utf8"));
        } catch (error) {
          throw new CliError("INVALID_WRITE", `${where}.file_path ${JSON.stringify(w.file_path)}: ${error.code === "ENOENT" ? "no such file" : `not JSON (${error.message})`}.`);
        }
      } else data = w.data;
      if (!isObject7(data)) throw new CliError("INVALID_WRITE", `${where}.data must be a JSON object (the document's fields).`);
      data = agent ? resolveFileRefs(data, `${where}.data`) : data;
      if (op === "set" && hasDeleteMarker(data)) throw new CliError("INVALID_WRITE", `${where}: {"__delete__": true} works only in an update; set writes the whole document.`);
    }
    const file = docFile(root, segs);
    const existing = fs19.existsSync(file) ? readDoc(root, p) : { exists: false };
    let next = null;
    if (op === "set") next = data;
    else if (op === "update") next = mergePatch(existing.exists ? existing.data : {}, data);
    if (next !== null) {
      const problem = documentProblem(root, segs, next);
      if (problem) throw new CliError("REFUSED", `${where}: ${problem}`);
      total += storeBytes(next);
    }
    planned.push({ op, path: p, file, next, created: !existing.exists && op !== "delete", existed: existing.exists });
  });
  if (total > MAX_BATCH_BYTES) throw new CliError("BATCH_TOO_LARGE", `The batch writes ${kib(total)}; a batch is at most 1 MB. Split it.`);
  const after = /* @__PURE__ */ new Map();
  const names = { modules: /* @__PURE__ */ new Set(), assets: /* @__PURE__ */ new Set() };
  const { docs } = readAllDocs(root);
  const pending = new Map(planned.map((w) => [w.path, w.next]));
  for (const p of /* @__PURE__ */ new Set([...docs.keys(), ...pending.keys()])) {
    const data = pending.has(p) ? pending.get(p) : docs.get(p);
    if (data === null) continue;
    const dir = p.slice(0, p.lastIndexOf("/"));
    after.set(dir, (after.get(dir) ?? 0) + storeBytes(data));
    if (dir === "modules" || dir === "assets") names[dir].add(p.slice(dir.length + 1));
  }
  for (const w of planned) {
    if (w.next === null) continue;
    const dir = w.path.slice(0, w.path.lastIndexOf("/"));
    if ((after.get(dir) ?? 0) > MAX_COLLECTION_BYTES) {
      throw new CliError("REFUSED", `${dir} would hold ${kib(after.get(dir))}; the store refuses a collection over 2 MiB. Shrink or drop a module; an image or font is an upload, not a data: URI.`);
    }
  }
  if (agent && names.modules.size > MAX_MODULES && planned.some((w) => w.created && w.path.startsWith("modules/"))) {
    throw new CliError("REFUSED", `The film would hold ${names.modules.size} modules; the player reads ${MAX_MODULES} (in name order) and drops the rest.`);
  }
  if (agent && names.assets.size > MAX_ASSETS && planned.some((w) => w.created && w.path.startsWith("assets/"))) {
    throw new CliError("REFUSED", `The film would hold ${names.assets.size} assets; the player reads ${MAX_ASSETS}.`);
  }
  for (const w of planned) {
    if (w.op === "delete") fs19.rmSync(w.file, { force: true });
    else writeFileAtomic(w.file, `${JSON.stringify(w.next, null, 2)}
`);
  }
  return planned.map((w) => ({
    op: w.op,
    path: w.path,
    ...w.next !== null ? { bytes: storeBytes(w.next) } : {},
    ...w.created ? { created: true } : {},
    ...w.op === "delete" && !w.existed ? { note: "there was no such document" } : {}
  }));
}
var blobFile = (root, id) => path18.join(root, "_blobs", id);
function readBlobMeta(root, id) {
  try {
    return JSON.parse(fs19.readFileSync(`${blobFile(root, id)}.json`, "utf8"));
  } catch {
    return null;
  }
}
function sniffType(b) {
  const ascii = (at, s) => b.length >= at + s.length && b.toString("latin1", at, at + s.length) === s;
  if (b.length >= 8 && b[0] === 137 && ascii(1, "PNG")) return "image/png";
  if (b.length >= 3 && b[0] === 255 && b[1] === 216 && b[2] === 255) return "image/jpeg";
  if (ascii(0, "GIF87a") || ascii(0, "GIF89a")) return "image/gif";
  if (ascii(0, "RIFF") && ascii(8, "WEBP")) return "image/webp";
  if (ascii(0, "wOF2")) return "font/woff2";
  if (ascii(0, "wOFF")) return "font/woff";
  if (ascii(0, "OTTO")) return "font/otf";
  if (b.length >= 4 && b.readUInt32BE(0) === 65536 || ascii(0, "true")) return "font/ttf";
  if (ascii(4, "ftyp")) return "video/mp4";
  if (b.length >= 4 && b.readUInt32BE(0) === 440786851) return "video/webm";
  if (ascii(0, "RIFF") && ascii(8, "WAVE")) return "audio/wav";
  if (ascii(0, "ID3") || b.length >= 4 && b[0] === 255 && (b[1] & 230) === 226) return "audio/mpeg";
  return null;
}
function audioSeconds(b, mime) {
  if (mime === "audio/wav") {
    let byteRate = 0;
    for (let at2 = 12; at2 + 8 <= b.length; ) {
      const id = b.toString("latin1", at2, at2 + 4);
      const size = b.readUInt32LE(at2 + 4);
      if (id === "fmt " && at2 + 20 <= b.length) byteRate = b.readUInt32LE(at2 + 16);
      if (id === "data") return byteRate > 0 ? Math.min(size, b.length - at2 - 8) / byteRate : null;
      at2 += 8 + size + (size & 1);
    }
    return null;
  }
  if (mime !== "audio/mpeg") return null;
  const RATES = [
    [0, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448],
    // MPEG-1 layer I
    [0, 32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384],
    // MPEG-1 layer II
    [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320],
    // MPEG-1 layer III
    [0, 32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256],
    // MPEG-2/2.5 layer I
    [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160]
    // MPEG-2/2.5 layers II, III
  ];
  let at = 0;
  if (b.toString("latin1", 0, 3) === "ID3" && b.length >= 10) at = 10 + ((b[6] & 127) << 21 | (b[7] & 127) << 14 | (b[8] & 127) << 7 | b[9] & 127);
  let seconds = 0;
  let frames = 0;
  while (at + 4 <= b.length) {
    if (b[at] !== 255 || (b[at + 1] & 224) !== 224) {
      if (frames > 0 && b.toString("latin1", at, at + 3) === "TAG") break;
      at++;
      continue;
    }
    const version = b[at + 1] >> 3 & 3;
    const layer = 4 - (b[at + 1] >> 1 & 3);
    const rateIndex = b[at + 2] >> 4;
    const srIndex = b[at + 2] >> 2 & 3;
    if (version === 1 || layer === 4 || rateIndex === 0 || rateIndex === 15 || srIndex === 3) {
      at++;
      continue;
    }
    const v1 = version === 3;
    const kbps = RATES[v1 ? layer - 1 : layer === 1 ? 3 : 4][rateIndex];
    const sampleRate = [44100, 48e3, 32e3][srIndex] / (v1 ? 1 : version === 2 ? 2 : 4);
    const pad = b[at + 2] >> 1 & 1;
    const samples = layer === 1 ? 384 : layer === 3 && !v1 ? 576 : 1152;
    const length = layer === 1 ? (Math.floor(12 * kbps * 1e3 / sampleRate) + pad) * 4 : Math.floor(samples / 8 * kbps * 1e3 / sampleRate) + pad;
    if (length < 4) {
      at++;
      continue;
    }
    const tag = frames === 0 ? b.toString("latin1", at + 4, Math.min(b.length, at + 4 + 40)) : "";
    if (!tag.includes("Xing") && !tag.includes("Info")) seconds += samples / sampleRate;
    frames++;
    at += length;
  }
  return frames > 0 ? seconds : null;
}
function assetBytes(root, asset) {
  const ref = String(asset.ref ?? "");
  const blob = BLOB_URL.exec(ref);
  if (blob) {
    const file = blobFile(root, blob[1]);
    return fs19.existsSync(file) ? fs19.readFileSync(file) : null;
  }
  const comma = ref.indexOf(",");
  return ref.startsWith("data:") && comma > 0 ? Buffer.from(ref.slice(comma + 1), "base64") : null;
}
function imageSize(b, type) {
  try {
    if (type === "image/png" && b.length >= 24) return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
    if (type === "image/gif" && b.length >= 10) return { w: b.readUInt16LE(6), h: b.readUInt16LE(8) };
    if (type === "image/webp" && b.length >= 30) {
      const kind = b.toString("latin1", 12, 16);
      if (kind === "VP8X") return { w: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3) };
      if (kind === "VP8L") {
        const bits = b.readUInt32LE(21);
        return { w: 1 + (bits & 16383), h: 1 + (bits >> 14 & 16383) };
      }
      if (kind === "VP8 ") return { w: b.readUInt16LE(26) & 16383, h: b.readUInt16LE(28) & 16383 };
    }
    if (type === "image/jpeg") {
      let i = 2;
      while (i + 9 < b.length) {
        if (b[i] !== 255) {
          i++;
          continue;
        }
        const marker = b[i + 1];
        if (marker === 216 || marker === 1 || marker >= 208 && marker <= 215) {
          i += 2;
          continue;
        }
        const len = b.readUInt16BE(i + 2);
        if (marker >= 192 && marker <= 207 && marker !== 196 && marker !== 200 && marker !== 204) return { w: b.readUInt16BE(i + 7), h: b.readUInt16BE(i + 5) };
        i += 2 + len;
      }
    }
  } catch {
  }
  return null;
}
function putBlob(root, bytes, name, contentType) {
  const id = createHash5("sha256").update(bytes).digest("hex").slice(0, 32);
  const file = blobFile(root, id);
  if (!fs19.existsSync(file)) writeFileAtomic(file, bytes);
  const size = contentType.startsWith("image/") ? imageSize(bytes, contentType) : null;
  const meta = { name, contentType, bytes: bytes.length, uploadedAt: (/* @__PURE__ */ new Date()).toISOString(), ...size ?? {} };
  writeFileAtomic(`${file}.json`, `${JSON.stringify(meta, null, 2)}
`);
  return { url: `/_blob/${id}`, id, name, bytes: bytes.length, content_type: contentType, ...size ?? {} };
}
function upload(root, given, flags) {
  if (!given) throw new CliError("MISSING_FILE", "Give the file to upload: an image (png, jpeg, gif, webp), a font (woff2, woff, ttf, otf), a clip (mp4, webm) or a voice take (mp3, wav).");
  const file = path18.resolve(given);
  const stat = fs19.statSync(file, { throwIfNoEntry: false });
  if (!stat) throw new CliError("FILE_NOT_FOUND", `No such file: ${given}`);
  if (!stat.isFile()) throw new CliError("NOT_A_FILE", `${given} is not a regular file.`);
  if (stat.size > MAX_UPLOAD_BYTES) throw new CliError("FILE_TOO_LARGE", `${given} is ${kib(stat.size)}; an upload here is at most ${kib(MAX_UPLOAD_BYTES)}. Shrink it first.`);
  const bytes = fs19.readFileSync(file);
  const name = flags.get("name") ?? path18.basename(file);
  if (extOf(name) === "svg" || /^\s*(<\?xml|<svg)/i.test(bytes.toString("utf8", 0, 200))) {
    throw new CliError("SVG_NOT_UPLOADED", "An SVG is never uploaded: put its <svg> markup in an html module, or give the asset a data:image/svg+xml;base64,\u2026 ref.");
  }
  const type = sniffType(bytes);
  if (!type) throw new CliError("UNSUPPORTED_TYPE", `${given} is not an image (png, jpeg, gif, webp), a font (woff2, woff, ttf, otf), a clip (mp4, webm) or a voice take (mp3, wav) the player reads. Convert it first.`);
  const result = putBlob(root, bytes, name, type);
  const asset = FILM_NAME.test(name) ? name : name.replace(/[^A-Za-z0-9_.-]/g, "-").replace(/^[^A-Za-z0-9]+/, "").slice(0, 64) || "asset";
  return {
    ...result,
    next: `Write assets/${asset} as {"ref": ${JSON.stringify(result.url)}, "mime": ${JSON.stringify(type)}${"w" in result ? `, "w": ${result.w}, "h": ${result.h}` : ""}} (write-db).`
  };
}
function referencesTo(root, id) {
  const { docs } = readAllDocs(root);
  const users = [];
  for (const [p, data] of docs) if (JSON.stringify(data).includes(id)) users.push(p);
  return users;
}
function deleteAsset(root, given) {
  const id = BLOB_URL.exec(String(given ?? ""))?.[1] ?? (BLOB_ID.test(String(given ?? "")) ? given : null);
  if (!id) throw new CliError("INVALID_ASSET", "Give the upload as its url (/_blob/<id>) or id (32 hex).");
  if (!fs19.existsSync(blobFile(root, id))) throw new CliError("NOT_FOUND", `No upload ${id} in ${root}/_blobs.`);
  const users = referencesTo(root, id);
  if (users.length > 0) throw new CliError("IN_USE", `${id} is still named by ${users.join(", ")}; change or delete those first.`);
  fs19.rmSync(blobFile(root, id), { force: true });
  fs19.rmSync(`${blobFile(root, id)}.json`, { force: true });
  return { deleted: `/_blob/${id}` };
}
function moduleText(docs, name) {
  const whole = docs.get(`modules/${name}`);
  if (whole && typeof whole.text === "string") return { text: whole.text, kind: String(whole.kind ?? ""), parts: 0 };
  if (UNSPLIT_MODULES.includes(name)) return null;
  const parts = [];
  for (const [p, data] of docs) {
    const m = /^modules\/(.*)~([1-9][0-9]?)$/.exec(p);
    if (m && m[1] === name) parts.push({ n: Number(m[2]), data });
  }
  if (parts.length === 0) return null;
  parts.sort((a, b) => a.n - b.n);
  return { text: parts.map((x) => String(x.data.text ?? "")).join(""), kind: String(parts[0].data.kind ?? ""), parts: parts.length };
}
function readDb(root, given, flags) {
  if (!given) {
    const files = listDocFiles(root);
    return {
      root,
      documents: [...files.keys()].sort().map((p) => ({ path: p, bytes: fs19.statSync(files.get(p).file).size }))
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
    if (segs[0] === "modules" && segs.length === 2) {
      const found = moduleText(readAllDocs(root).docs, segs[1]);
      if (!found) throw new CliError("NOT_FOUND", `No module ${segs[1]} (nor its parts ${segs[1]}~1 \u2026).`);
      return { raw: found.text };
    }
    if (!doc.exists) throw new CliError("NOT_FOUND", `No document ${doc.path}.`);
    const text = typeof doc.data.text === "string" ? doc.data.text : typeof doc.data.code === "string" ? doc.data.code : null;
    if (text === null) throw new CliError("NO_TEXT", `${doc.path} has no text or code field.`);
    return { raw: text };
  }
  return doc.exists ? { path: doc.path, exists: true, data: doc.data } : { path: doc.path, exists: false };
}
function syntaxError(code, label) {
  try {
    new vm.Script(`{ const kit = undefined;
${code}
}`, { filename: label });
    return null;
  } catch (error) {
    const stack = String(error.stack ?? "");
    const at = new RegExp(`${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:(\\d+)`).exec(stack);
    const line = at ? Number(at[1]) - 1 : null;
    return `${error.message}${line ? ` (line ${line})` : ""}`;
  }
}
function check(root) {
  const { docs, damaged } = readAllDocs(root);
  const problems = [];
  const warnings = [];
  const problem = (doc, message) => problems.push(`${doc}: ${message}`);
  const warn = (doc, message) => warnings.push(`${doc}: ${message}`);
  for (const p of damaged) problem(p, "is not a JSON object; rewrite it with set.");
  const totals = /* @__PURE__ */ new Map();
  for (const [p, data] of docs) {
    const segs = p.split("/");
    const dir = segs.slice(0, -1).join("/");
    totals.set(dir, (totals.get(dir) ?? 0) + storeBytes(data));
    if (!["film", "modules", "assets"].includes(dir)) warn(p, "is in a collection the player does not read.");
    const bad = documentProblem(root, segs, data);
    if (bad) problem(p, bad.startsWith(p) ? bad.slice(p.length).replace(/^:\s*/, "") : bad);
  }
  for (const [dir, bytes] of totals) if (bytes > MAX_COLLECTION_BYTES) problem(dir, `holds ${kib(bytes)}; the store refuses a collection over 2 MiB.`);
  const meta = docs.get("film/meta");
  if (!meta) problem("film/meta", 'missing: write {"v":1, "title":"\u2026", "updatedAt":"\u2026"} first.');
  else if (meta.v !== 1) warn("film/meta", "v is 1.");
  const script2 = docs.get("film/script");
  if (!script2) problem("film/script", 'missing: the page shows "No animation yet" until it is written (last in its batch).');
  else if (typeof script2.code === "string") {
    if (!script2.code.trim()) problem("film/script", "code is empty.");
    const err = syntaxError(script2.code, "cut.js");
    if (err) problem("film/script", `does not parse: ${err}`);
    if (!/window\.CUT\b/.test(script2.code)) warn("film/script", "never sets window.CUT.");
  }
  const moduleIds = [...docs.keys()].filter((p) => p.startsWith("modules/") && p.split("/").length === 2).map((p) => p.slice(8));
  if (moduleIds.length > MAX_MODULES) problem("modules", `${moduleIds.length} documents; the player reads ${MAX_MODULES} (in name order: ${moduleIds.sort().slice(MAX_MODULES).join(", ")} would be dropped).`);
  const logical = /* @__PURE__ */ new Set();
  const partsOf = /* @__PURE__ */ new Map();
  for (const id of moduleIds) {
    const m = /^(.*)~([1-9][0-9]?)$/.exec(id);
    if (m && !UNSPLIT_MODULES.includes(m[1])) partsOf.set(m[1], [...partsOf.get(m[1]) ?? [], Number(m[2])]);
    else logical.add(id);
  }
  for (const [name, ns] of partsOf) {
    if (logical.has(name)) {
      warn(`modules/${name}`, `exists whole and in parts (${name}~${ns.join(", ~")}); the player reads the whole one and ignores the parts.`);
      continue;
    }
    ns.sort((a, b) => a - b);
    if (ns.some((n, i) => n !== i + 1)) warn(`modules/${name}`, `its parts are ~${ns.join(", ~")}; the player joins them in that order, so a gap means a missing piece.`);
    logical.add(name);
  }
  const texts = /* @__PURE__ */ new Map();
  for (const name of logical) {
    const found = moduleText(docs, name);
    if (!found) continue;
    texts.set(name, found.text);
    const label = `modules/${name}`;
    const kind = /\.json$/i.test(name) ? "json" : found.kind;
    if (kind === "json") {
      try {
        JSON.parse(found.text);
      } catch (error) {
        problem(label, `is not JSON: ${error.message}`);
      }
    } else if (kind === "js") {
      const err = syntaxError(found.text, name);
      if (err) problem(label, `does not parse: ${err}`);
    }
    if (/\.js$/i.test(name) && found.kind !== "js") warn(label, `kind is ${JSON.stringify(found.kind || void 0)}; a module the cut runs is kind "js".`);
  }
  let scenesInfo = null;
  let sceneDurs = null;
  const scenesText = texts.get("scenes.json");
  if (scenesText !== void 0) {
    let scenes;
    try {
      scenes = JSON.parse(scenesText);
    } catch {
    }
    if (isObject7(scenes)) {
      const label = "modules/scenes.json";
      if (scenes.v !== 1) problem(label, "v is 1.");
      if (scenes.stage !== "rough" && scenes.stage !== "final") problem(label, 'stage is "rough" until the end, then "final".');
      if (scenes.transition != null) {
        const tr = scenes.transition;
        if (!isObject7(tr) || !Array.isArray(tr.colors) || tr.colors.length < 1 || tr.colors.length > 3 || tr.colors.some((c) => typeof c !== "string" || !c)) problem(label, 'transition is {"colors": ["#D9775A", "#1c1915"], "dur": 0.7}: one to three colours (a bad one stops the whole film).');
        else if (tr.dur != null && !(typeof tr.dur === "number" && tr.dur >= 0.3 && tr.dur <= 1.5)) problem(label, "transition.dur is 0.3 to 1.5 seconds (a bad one stops the whole film).");
      }
      if (Array.isArray(scenes.palettes) && scenes.palettes.length > 1) {
        const own = new Set([...(texts.get("base.css") ?? "").matchAll(/--(?:ground|main|second|accent)\s*:\s*(#[0-9a-f]{6})\b/gi)].map((m) => m[1].toLowerCase()));
        const off = /* @__PURE__ */ new Map();
        for (const [name, text] of texts) {
          if (!/\.(js|css|html)$/i.test(name)) continue;
          const bare = text.replace(/rgba?\(\s*0(?:\s*,\s*|\s+)0(?:\s*,\s*|\s+)0\s*[,/]\s*(?:0?\.\d+|\d{1,2}%)\s*\)/gi, "");
          for (const m of bare.matchAll(/#[0-9a-f]{3,8}(?![\w-])|\brgba?\([^)]*\)/gi)) {
            if (!own.has(m[0].toLowerCase())) off.set(name, (off.get(name) ?? /* @__PURE__ */ new Set()).add(m[0]));
          }
        }
        if (off.size) warn(label, `Style offers no palette of another tone while a colour is off the film's four (${[...off].map(([name, set]) => `${name}: ${[...set].slice(0, 4).join(" ")}`).join("; ")}). A shade is color-mix of the variables; a patch over an image is an image.`);
      }
      const list = Array.isArray(scenes.scenes) ? scenes.scenes : null;
      if (!list || list.length === 0) problem(label, "scenes is a list of {id, name, dur, desc}, at least one.");
      else {
        if (list.length > MAX_SCENES) problem(label, `${list.length} scenes; ${MAX_SCENES} at most.`);
        const ids = /* @__PURE__ */ new Set();
        let seconds = 0;
        const missing = [];
        sceneDurs = /* @__PURE__ */ new Map();
        const listIds = new Set(list.flatMap((s) => isObject7(s) && typeof s.id === "string" ? [s.id] : []));
        const renamed = /* @__PURE__ */ new Set();
        for (const [name, text] of texts) {
          const m = /^(.+)\.js$/.exec(name);
          if (!m || !listIds.has(m[1]) || texts.has(`scene-${m[1]}.js`) || ["shared", "score", "narration"].includes(m[1])) continue;
          if (new RegExp(`\\bkit\\.scene\\s*\\(\\s*['"\`]${m[1].replace(/[^\w-]/g, "")}['"\`]`).test(text)) {
            renamed.add(m[1]);
            warn(`modules/${name}`, `the player runs it as scene "${m[1]}" but a scene's code belongs in modules/scene-${m[1]}.js; rename the file.`);
          }
        }
        for (const name of texts.keys()) {
          const scene = /^scene-(.+)\.js$/.exec(name);
          if (scene && !listIds.has(scene[1])) warn(`modules/${name}`, `scene-<id>.js is for a scene of scenes.json, and "${scene[1]}" is not one; the player runs no other module so.`);
          if (/^layer-/.test(name)) warn(`modules/${name}`, "names that begin layer- are the player's; name no module so.");
        }
        list.forEach((s, i) => {
          const at = `${label} scenes[${i}]`;
          if (!isObject7(s)) return problem(at, "is not an object.");
          if (typeof s.id !== "string" || !SCENE_ID.test(s.id)) problem(at, `id ${JSON.stringify(s.id)}: lower-case letters, digits and -, a letter first, 32 at most (a bad id stops the whole film).`);
          else if (ids.has(s.id)) problem(at, `id ${s.id} appears twice.`);
          else ids.add(s.id);
          if (typeof s.name !== "string" || !s.name.trim() || s.name.length > 48) problem(at, "name: one to three words, 48 characters at most.");
          if (typeof s.dur !== "number" || !Number.isFinite(s.dur) || s.dur <= 0) problem(at, "dur: seconds, above 0 (a bad dur stops the whole film).");
          else {
            seconds += s.dur;
            if (typeof s.id === "string") sceneDurs.set(s.id, s.dur);
          }
          if (typeof s.id === "string" && !texts.has(`scene-${s.id}.js`) && !renamed.has(s.id)) missing.push(`${i + 1} (${s.id})`);
        });
        if (seconds > MAX_SECONDS) problem(label, `the scenes add up to ${seconds} s; a film over ${MAX_SECONDS} s won't load.`);
        scenesInfo = { stage: scenes.stage, scenes: list.length, seconds: Math.round(seconds * 1e3) / 1e3, ...missing.length ? { scenesLeft: missing } : {} };
        if (missing.length && scenes.stage === "final") problem(label, `stage is "final" but scene modules are missing: ${missing.join(", ")}.`);
      }
      for (const k of ["width", "height", "fps"]) if (scenes[k] !== void 0 && (typeof scenes[k] !== "number" || scenes[k] <= 0)) problem(label, `${k} is a positive number.`);
    }
  } else if (script2 && typeof script2.code === "string" && /kit\.scenes\s*\(/.test(script2.code)) {
    problem("film/script", "calls kit.scenes() but there is no modules/scenes.json.");
  }
  let voiceInfo = null;
  const voiceText = texts.get("voice.json");
  if (voiceText !== void 0) {
    let voice;
    try {
      voice = JSON.parse(voiceText);
    } catch {
    }
    const label = "modules/voice.json";
    if (isObject7(voice)) {
      if (voice.v !== 1) problem(label, "v is 1.");
      const gap = typeof voice.gap === "number" && voice.gap >= 0 && voice.gap <= 5 ? voice.gap : 0.45;
      if (voice.gap !== void 0 && gap !== voice.gap) warn(label, "gap is the seconds after a take before the next scene, 0 to 5; 0.45 is used.");
      if (voice.lead !== void 0 && !(typeof voice.lead === "number" && voice.lead >= 0 && voice.lead <= 1)) warn(label, "lead is the seconds the picture moves ahead of the voice, 0 to 1; 0.08 is used.");
      if (voice.captions !== void 0 && voice.captions !== false && !isObject7(voice.captions)) warn(label, "captions is false, or {maxWidth, at, size, style}.");
      if (texts.has("narration.js")) warn(label, "narration.js is here too: when its narration has lines, the film speaks those and not voice.json (whose cues still time the scenes).");
      const list = Array.isArray(voice.scenes) ? voice.scenes : null;
      if (!list) problem(label, "scenes is a list of {id, lines, audio, speech, chars}, a take a scene.");
      else {
        const seen = /* @__PURE__ */ new Set();
        let spoken = 0;
        let takes = 0;
        let aligned = 0;
        let stale = 0;
        list.forEach((v, i) => {
          const at = `${label} scenes[${i}]`;
          if (!isObject7(v)) return problem(at, "is not an object.");
          if (typeof v.id !== "string" || !v.id) return problem(at, "id is the id of its scene in scenes.json.");
          const where = `${label} ${v.id}`;
          if (seen.has(v.id)) return problem(where, "appears twice; the player keeps the first.");
          seen.add(v.id);
          if (sceneDurs && !sceneDurs.has(v.id)) warn(where, "is no scene of scenes.json; the player leaves it out.");
          const lines = Array.isArray(v.lines) ? v.lines.filter((l) => typeof l === "string" && voiceStrip(l) !== "") : [];
          if (!Array.isArray(v.lines) || lines.length === 0 || lines.length !== v.lines.length) problem(where, "lines is a list of what the scene says, a beat a line, each of them words.");
          let measured = null;
          if (v.audio !== void 0) {
            const asset = typeof v.audio === "string" && v.audio ? docs.get(`assets/${v.audio}`) : void 0;
            if (typeof v.audio !== "string" || !v.audio) problem(where, "audio is the name of its take, an audio asset (assets/<name>).");
            else if (!asset) problem(where, `audio ${v.audio} is no asset of this film, so the scene is silent: upload the take (${cmd("upload", root, "<file>")}) and write assets/${v.audio}.`);
            else if (!/^audio\//.test(String(asset.mime))) problem(where, `audio ${v.audio} is ${asset.mime}, not a take (audio/mpeg or audio/wav).`);
            else {
              takes++;
              const bytes = assetBytes(root, asset);
              if (bytes) {
                if (bytes.length > NARRATION_MAX_ASSET_KIB * 1024) problem(where, `its take is ${kib(bytes.length)}; the player leaves a take over ${NARRATION_MAX_ASSET_KIB} KiB silent: encode it smaller (a mono mp3 at 64-96 kbps).`);
                measured = audioSeconds(bytes, String(asset.mime));
              }
            }
          }
          if (v.hash !== void 0 && typeof v.hash !== "string") warn(where, "hash is the hash of the lines its take says, a string.");
          else if (isStaleTake(voice, v)) {
            stale++;
            warn(where, `its lines changed after its take was made (hash; or say, or the voice settings): ${cmd("voice", root, "--only", v.id)} makes it again (a take of your own: ${cmd("voice", root, "--take", `${v.id}=<file>`)}), then align and sync.`);
          }
          const speech = typeof v.speech === "number" && Number.isFinite(v.speech) && v.speech > 0 ? v.speech : null;
          const round = (n) => Math.round(n * 100) / 100;
          if (v.speech !== void 0 && speech === null) problem(where, "speech is the take's seconds, above 0.");
          else if (speech === null && measured !== null) warn(where, `has no speech; its take runs ${round(measured)} s: set speech to that.`);
          else if (speech === null && v.audio !== void 0) warn(where, "has no speech, so its length is guessed from its words: set it to the take's seconds.");
          else if (speech !== null && measured !== null && Math.abs(speech - measured) > 0.25) warn(where, `speech is ${speech} s but its take runs ${round(measured)} s: set speech to ${round(measured)}.`);
          const hold = typeof v.hold === "number" && v.hold >= 0 && v.hold <= 30 ? v.hold : 0;
          if (v.hold !== void 0 && hold !== v.hold) warn(where, "hold is the seconds the scene stays after its take and the gap, 0 to 30; 0 is used.");
          const length = speech ?? measured;
          if (length !== null) {
            spoken += length;
            if (length > NARRATION_MAX_LINE_SECONDS) problem(where, `its take runs ${round(length)} s; the player leaves a take over ${NARRATION_MAX_LINE_SECONDS} s silent: split the scene in two.`);
            const dur = sceneDurs?.get(v.id);
            const want = round(length + gap + hold);
            const parts = `its take (${round(length)} s) and the gap (${gap} s)${hold ? ` and its hold (${hold} s)` : ""}`;
            if (dur !== void 0 && length > dur + 0.05) warn(where, `its take (${round(length)} s) runs past the scene's end (${dur} s), over the next scene: set the scene's dur to ${want} (${parts}).`);
            else if (dur !== void 0 && Math.abs(dur - want) > 0.05) warn(where, `the scene lasts ${dur} s; with ${parts} its dur is ${want}.`);
          }
          if (v.chars !== void 0) {
            const total = lines.reduce((n, l) => n + voiceStrip(l).length, 0);
            const chars = Array.isArray(v.chars) ? v.chars : [];
            if (!Array.isArray(v.chars) || !chars.every((x) => typeof x === "number" && Number.isFinite(x))) problem(where, "chars is a list of seconds: when each character of the lines starts, then the end.");
            else if (chars.length !== total + 1) warn(where, `chars holds ${chars.length} times but its lines have ${total} characters (${total + 1} times with the end), so its times are guessed: align the take again after changing its lines.`);
            else {
              aligned++;
              if (chars.some((x, k) => k > 0 && x < chars[k - 1] - 1e-3)) warn(where, "chars goes back in time somewhere; each time is at or after the one before.");
            }
          }
        });
        voiceInfo = { scenes: seen.size, takes, aligned, seconds: Math.round(spoken * 100) / 100, ...stale > 0 ? { stale } : {} };
      }
    } else if (voice !== void 0) problem(label, 'is {"v": 1, "lang": "zh", "scenes": [{id, lines, audio, speech, chars}]}.');
  }
  const assetIds = [...docs.keys()].filter((p) => p.startsWith("assets/") && p.split("/").length === 2);
  if (assetIds.length > MAX_ASSETS) problem("assets", `${assetIds.length} documents; the player reads ${MAX_ASSETS}.`);
  for (const p of assetIds) {
    const data = docs.get(p);
    const blob = BLOB_URL.exec(String(data.ref ?? ""));
    if (!blob) continue;
    const meta2 = readBlobMeta(root, blob[1]);
    if (meta2 && meta2.contentType !== data.mime) {
      if (String(data.mime).startsWith("audio/") || String(meta2.contentType).startsWith("audio/")) problem(p, `mime is ${data.mime}, but the upload is ${meta2.contentType}; the player drops an audio asset whose mime and upload type differ. Use the upload reply's content_type, verbatim.`);
      else warn(p, `mime is ${data.mime}, but the upload is ${meta2.contentType}; the player trusts mime.`);
    }
  }
  const result = {
    root,
    title: meta && typeof meta.title === "string" ? meta.title : null,
    documents: docs.size,
    modules: logical.size,
    assets: assetIds.length,
    sizes: Object.fromEntries([...totals].map(([dir, bytes]) => [dir, kib(bytes)])),
    ...scenesInfo ? { scenes: scenesInfo } : {},
    ...voiceInfo ? { voice: voiceInfo } : {},
    problems: problems.length,
    ...problems.length ? { issues: problems } : {},
    ...warnings.length ? { warnings } : {}
  };
  return { result, problems: problems.length };
}
function moduleDocs(name, kind, text) {
  const room = MAX_DOC_BYTES - 1024;
  if (storeBytes({ kind, text }) <= room) return [{ name, text }];
  const parts = [];
  let part = "";
  for (const line of text.split(/(?<=\n)/)) {
    if (part && storeBytes({ kind, text: part + line }) > room) {
      parts.push({ name: `${name}~${parts.length + 1}`, text: part });
      part = "";
    }
    part += line;
  }
  if (part) parts.push({ name: `${name}~${parts.length + 1}`, text: part });
  if (parts.length > 99 || parts.some((p) => storeBytes({ kind, text: p.text }) > room)) throw new CliError("TOO_LARGE", `${name} does not fit the store, even split in parts.`);
  return parts;
}
var jsonText = (value) => `${JSON.stringify(value, null, 2).replace(/\[\s+(-?[\d.e+-]+(?:,\s+-?[\d.e+-]+)*)\s+\]/g, (_, inner) => `[${inner.split(/,\s+/).join(", ")}]`)}
`;
function importExplainer(from, given, flags) {
  if (!from || !given) throw new CliError("MISSING_ARGUMENT", "Give the explainer project, then the new film folder: import-explainer <project> <root> [--v zh] [--size WxH].");
  const dir = path18.resolve(from);
  if (!fs19.statSync(dir, { throwIfNoEntry: false })?.isDirectory()) throw new CliError("NOT_FOUND", `${from} is not a folder.`);
  let x;
  try {
    x = readExplainer(dir, { variant: flags.get("v"), size: flags.get("size") });
  } catch (error) {
    if (error instanceof ExplainerError) throw new CliError("NOT_AN_EXPLAINER", error.message);
    throw error;
  }
  if (x.scenes.length > MAX_SCENES) throw new CliError("TOO_MANY_SCENES", `${x.scenes.length} scenes; a film has ${MAX_SCENES} at most.`);
  const root = resolveRoot(given, { create: true });
  if (listDocFiles(root).size > 0) throw new CliError("NOT_EMPTY", `${root} already holds a film; import into a new folder.`);
  const notes = [...x.notes];
  const writes = [];
  const set = (p, data) => writes.push({ op: "set", path: p, data });
  const mod = (name, kind, text) => {
    for (const part of moduleDocs(name, kind, text)) set(`modules/${part.name}`, { kind, text: part.text });
  };
  const voiceScenes = [];
  const durs = [];
  let takes = 0;
  for (const s of x.scenes) {
    let speech = s.speech;
    let audio;
    if (s.take) {
      const bytes2 = fs19.readFileSync(s.take);
      const type = sniffType(bytes2);
      if (type !== "audio/mpeg" && type !== "audio/wav") notes.push(`${path18.relative(dir, s.take)} is not an mp3 or a wav; scene ${s.id} is silent.`);
      else {
        audio = `voice-${x.variant ? `${x.variant}-` : ""}${s.id}.${type === "audio/wav" ? "wav" : "mp3"}`;
        const up = putBlob(root, bytes2, audio, type);
        set(`assets/${audio}`, { ref: up.url, mime: type });
        takes++;
        const measured = audioSeconds(bytes2, type);
        if (speech === null && measured !== null) speech = Math.round(measured * 1e3) / 1e3;
        if (bytes2.length > NARRATION_MAX_ASSET_KIB * 1024) notes.push(`${path18.relative(dir, s.take)} is ${kib(bytes2.length)}; the player leaves a take over ${NARRATION_MAX_ASSET_KIB} KiB silent: encode it smaller (a mono mp3 at 64-96 kbps) and upload it again.`);
      }
    } else notes.push(`scene ${s.engine} has no take (audio/${x.variant ? `${x.variant}/` : ""}${s.engine}.mp3): it is silent.`);
    const length = speech ?? guessSpeech(s.lines, x.lang);
    if (speech === null) notes.push(`scene ${s.engine} has neither a timing nor a take to measure: it lasts ${length} s, a guess from its words.`);
    durs.push(Math.round((length + x.gap + s.hold) * 1e3) / 1e3);
    voiceScenes.push({ id: s.id, lines: s.lines, ...audio ? { audio } : {}, ...speech !== null ? { speech } : {}, ...s.chars ? { chars: s.chars } : {}, ...s.hold ? { hold: s.hold } : {} });
  }
  const images = {};
  for (const img of x.images) {
    images[img.key] = img.asset;
    if (img.mime === "image/svg+xml") set(`assets/${img.asset}`, { ref: `data:image/svg+xml;base64,${img.bytes.toString("base64")}`, mime: img.mime });
    else {
      const up = putBlob(root, img.bytes, img.asset, img.mime);
      set(`assets/${img.asset}`, { ref: up.url, mime: img.mime, ...up.w ? { w: up.w, h: up.h } : {} });
    }
  }
  mod(
    "explainer.json",
    "json",
    jsonText({
      v: 1,
      from: path18.basename(dir),
      variant: x.variant,
      images,
      load: x.load.map((c) => c.module),
      draw: x.draw.map((c) => c.module),
      scenes: x.scenes.map((s) => ({ id: s.id, engine: s.engine, title: s.title }))
    })
  );
  mod("voice.json", "json", jsonText({ v: 1, lang: x.lang, gap: x.gap, captions: false, scenes: voiceScenes }));
  mod(
    "scenes.json",
    "json",
    jsonText({
      v: 1,
      stage: "final",
      width: x.width,
      height: x.height,
      fps: 30,
      background: "#000000",
      scenes: x.scenes.map((s, i) => ({ id: s.id, name: Array.from(s.title).slice(0, 48).join(""), dur: durs[i], desc: Array.from(voiceStrip(s.lines[0] ?? "")).slice(0, 160).join("") }))
    })
  );
  mod("shared.js", "js", BOOT);
  for (const s of x.scenes) mod(`scene-${s.id}.js`, "js", sceneModule(s.id, s.engine));
  for (const c of [...x.load, ...x.draw]) mod(c.module, "js", c.text);
  set("film/meta", { v: 1, title: x.title, updatedAt: (/* @__PURE__ */ new Date()).toISOString() });
  set("film/script", { code: "window.CUT = kit.scenes();\n" });
  const modules = writes.filter((w) => w.path.startsWith("modules/")).length;
  if (modules > MAX_MODULES) throw new CliError("TOO_MANY_MODULES", `the film would hold ${modules} modules; the player reads ${MAX_MODULES}. Fewer scenes or scene files.`);
  for (const w of writes) {
    const problem = documentProblem(root, docSegments(w.path), w.data);
    if (problem) throw new CliError("REFUSED", problem);
  }
  let batch = [];
  let bytes = 0;
  for (const w of writes) {
    const size = storeBytes(w.data);
    if (batch.length && (batch.length >= MAX_BATCH_WRITES || bytes + size > MAX_BATCH_BYTES)) {
      applyWrites(root, batch);
      batch = [];
      bytes = 0;
    }
    batch.push(w);
    bytes += size;
  }
  applyWrites(root, batch);
  const checked = check(root).result;
  if (x.fonts.length) notes.push(`index.html loads the web fonts ${x.fonts.join(", ")}; the player does not, so the canvas uses them if they are installed here, else a font of the system's.`);
  return {
    root,
    from: dir,
    variant: x.variant,
    size: `${x.width}x${x.height}`,
    title: x.title,
    scenes: x.scenes.length,
    takes,
    aligned: x.scenes.filter(alignedChars).length,
    seconds: Math.round(durs.reduce((a, b) => a + b, 0) * 100) / 100,
    code: [...x.load, ...x.draw].map((c) => `modules/${c.module} \u2190 ${c.file}`),
    ...notes.length ? { notes } : {},
    check: { problems: checked.problems, ..."issues" in checked ? { issues: checked.issues } : {}, ..."warnings" in checked ? { warnings: checked.warnings } : {} },
    next: `${cmd("open", root)} plays it.`
  };
}
function filmStore(root) {
  return {
    root,
    readAllDocs: () => readAllDocs(root),
    moduleText,
    applyWrites: (writes) => applyWrites(root, writes),
    putBlob: (bytes, name, contentType) => putBlob(root, bytes, name, contentType),
    assetBytes: (asset) => assetBytes(root, asset),
    sniffType,
    audioSeconds,
    storeBytes,
    maxDocBytes: MAX_DOC_BYTES,
    maxFilmSeconds: MAX_SECONDS,
    maxTakeKib: NARRATION_MAX_ASSET_KIB,
    maxTakeSeconds: NARRATION_MAX_LINE_SECONDS,
    cmd,
    editorDir: EDITOR_DIR
  };
}
var runningServer2 = (root) => runningServer(root, "motion", "_api/session");
function serverFlags(flags) {
  const out = [];
  if (flags.has("port")) out.push("--port", flags.get("port"));
  if (flags.has("host")) out.push("--host", flags.get("host"));
  if (flags.has("agent-hook")) out.push("--agent-hook", flags.get("agent-hook"));
  if (flags.has("lan")) out.push("--lan");
  return out;
}
function sendRanged(req, res, file, size, headers) {
  const range = /^bytes=(\d*)-(\d*)$/.exec(String(req.headers.range ?? ""));
  let start = 0;
  let end = size - 1;
  let status = 200;
  if (range && (range[1] || range[2])) {
    if (range[1]) {
      start = Number(range[1]);
      if (range[2]) end = Math.min(Number(range[2]), size - 1);
    } else start = Math.max(0, size - Number(range[2]));
    if (start > end || start >= size) {
      res.writeHead(416, { "Content-Range": `bytes */${size}` });
      res.end();
      return;
    }
    status = 206;
  }
  res.writeHead(status, {
    ...headers,
    "Accept-Ranges": "bytes",
    "Content-Length": end - start + 1,
    ...status === 206 ? { "Content-Range": `bytes ${start}-${end}/${size}` } : {}
  });
  if (req.method === "HEAD" || size === 0) {
    res.end();
    return;
  }
  const stream = fs19.createReadStream(file, { start, end });
  stream.on("error", () => res.destroy());
  res.on("close", () => stream.destroy());
  stream.pipe(res);
}
var historyTracks = (p) => p.split("/")[0] !== "data";
function historyLabel(p) {
  if (p === "film/meta") return { en: "Title and settings", zh: "\u6807\u9898\u548C\u8BBE\u7F6E" };
  if (p === "film/script") return { en: "Script", zh: "\u811A\u672C" };
  const [collection, id] = p.split("/");
  if (collection === "modules" && id) return { en: `Module \xB7 ${id}`, zh: `\u6A21\u5757 \xB7 ${id}` };
  if (collection === "assets" && id) return { en: `Asset \xB7 ${id}`, zh: `\u7D20\u6750 \xB7 ${id}` };
  return null;
}
async function serve(root, flags) {
  if (!fs19.existsSync(path18.join(EDITOR_DIR, "index.html")) || !fs19.existsSync(path18.join(EDITOR_DIR, "local-host.js"))) {
    throw new CliError("EDITOR_MISSING", `The player page is missing (${EDITOR_DIR}); reinstall the skill.`);
  }
  const existing = await runningServer2(root);
  if (existing && existing.pid !== process.pid) {
    print({ url: existing.url, root, pid: existing.pid, reused: true, ...await lanOn2(existing.url, flags) }, true);
    return false;
  }
  const host = flags.get("host") ?? "127.0.0.1";
  const port = flags.has("port") ? Number(flags.get("port")) : DEFAULT_PORTS.motion;
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new CliError("INVALID_PORT", "--port is a number from 0 to 65535.");
  const agentHook = flags.get("agent-hook");
  if (agentHook === "true" || agentHook === "") throw new CliError("MISSING_HOOK", "--agent-hook takes the command to run, in quotes.");
  const background = flags.has("background");
  const state = await serveHub({ kind: "motion", script: SCRIPT, root, port, portGiven: flags.has("port"), host, ...agentHook ? { agentHook } : {}, lan: flags.has("lan"), background, site: mountSite });
  print({ url: state.url, root, pid: state.pid, ...state.lan?.length ? { lan: state.lan } : {} }, true);
  return !(state.joined && background);
}
function mountSite(root, { log: log3, network, agentHook, local, agentName }) {
  const dbDir = path18.join(root, "db");
  fs19.mkdirSync(dbDir, { recursive: true });
  const known = /* @__PURE__ */ new Map();
  const clients = /* @__PURE__ */ new Map();
  const presence = new PresenceHub();
  const send = (res, event, data) => res.write(`event: ${event}
data: ${JSON.stringify(data)}

`);
  const reads = (viewer, p) => dbAccess(viewer, p.split("/")).read;
  const snapshot = (viewer) => Object.fromEntries([...known].filter(([p]) => reads(viewer, p)).map(([p, k]) => [p, JSON.parse(k.text)]));
  const page = pagePathOf("motion", root);
  const history = new DbHistory({
    root,
    tracked: historyTracks,
    labels: () => historyLabel,
    base: page,
    write: (p, data) => void applyWrites(root, [data === null ? { op: "delete", path: p } : { op: "set", path: p, data }], { agent: false }),
    rescan: () => rescan(),
    log: log3
  });
  const docsAt = (n) => history.docsAt(n, new Map([...known].map(([p, k]) => [p, JSON.parse(k.text)])));
  function rescan() {
    const files = listDocFiles(root);
    const changes = [];
    for (const [p, { file }] of files) {
      let stat;
      try {
        stat = fs19.statSync(file);
      } catch {
        continue;
      }
      const prev = known.get(p);
      if (prev && prev.mtimeMs === stat.mtimeMs && prev.size === stat.size) continue;
      let data;
      try {
        data = JSON.parse(fs19.readFileSync(file, "utf8"));
        if (!isObject7(data)) throw new Error("not an object");
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
    const made = history.record(changes, (p) => files.has(p));
    const byAgent = made.filter((v) => v.by === "agent").flatMap((v) => Object.keys(v.changes));
    if (byAgent.length) presence.agentActive({ where: agentWhere(byAgent.at(-1), byAgent.length, (p) => historyLabel(p) ?? { en: p, zh: p }) });
    if (changes.length) {
      for (const [res, viewer] of clients) {
        const seen = changes.filter((c) => reads(viewer, c.path));
        if (seen.length) send(res, "change", { changes: seen });
      }
      log3(`changed: ${changes.map((c) => c.path).join(", ")}`);
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
    watcher = fs19.watch(dbDir, { recursive: true }, soon);
    watcher.on("error", () => {
    });
  } catch (error) {
    log3(`file watching unavailable (${error.message}); polling instead`);
  }
  const poll = setInterval(rescan, watcher ? 2e3 : 700);
  const owner = localOwner();
  const share2 = new ShareHost({
    root,
    page,
    network,
    cookieName: guestCookieName("motion", root),
    owner,
    noun: NOUNS.motion,
    title: () => filmTitle(root),
    log: log3,
    uiFile: path18.join(EDITOR_DIR, "share-ui.js"),
    ...local ? { local } : {},
    ...agentName ? { agentName } : {},
    globals: (viewer, query) => ({ __baoyuHistory: history.bootGlobal(viewer, query) })
  });
  const comments = createCommentsService({
    root,
    log: log3,
    agentHook,
    userName: owner.name,
    allowWrite: sameOrigin,
    viewer: (req) => {
      const viewer = share2.viewerOf(req);
      return viewer ? commentsViewer(viewer) : null;
    }
  });
  const json = (res, status, body) => sendJson(res, status, body);
  const serveFile = (req, res, file, type, cache) => {
    fs19.stat(file, (error, stat) => {
      if (error || !stat.isFile()) return json(res, 404, { code: "not_found", message: "Not found" });
      sendRanged(req, res, file, stat.size, { "Content-Type": type, "Cache-Control": cache, "X-Content-Type-Options": "nosniff" });
    });
  };
  const servePage = (req, res, viewer, at) => {
    let html;
    try {
      html = fs19.readFileSync(path18.join(EDITOR_DIR, "index.html"), "utf8");
    } catch {
      return json(res, 404, { code: "not_found", message: "The player page is missing." });
    }
    const body = Buffer.from(share2.injectHead(html, viewer, at === void 0 ? "" : `?at=${at}`) ?? html);
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Content-Length": body.length, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
    res.end(req.method === "HEAD" ? void 0 : body);
  };
  async function handle(req, res) {
    try {
      const url = new URL(req.url ?? "/", "http://local");
      const read = req.method === "GET" || req.method === "HEAD";
      if (await share2.route(req, res)) return;
      const viewer = share2.viewerOf(req);
      if (!viewer) return share2.denied(req, res);
      const p = url.pathname;
      if (req.method === "POST" && !sameOrigin(req)) return json(res, 403, { code: "not_granted", message: "Cross-origin write refused." });
      const preview = previewOf(url.searchParams);
      const editing = canEditAs(viewer.role) && preview === void 0;
      if (read && (p === "/" || p === "/index.html")) return servePage(req, res, viewer, preview);
      if (p === "/__presence" && preview === void 0) return presence.handle(req, res, viewer);
      if (p === "/__history" || p.startsWith("/__history/")) {
        if (await history.host.handle(req, res, p.slice("/__history".length), viewer)) return;
        req.resume();
        return json(res, 404, { code: "not_found", message: "Not found" });
      }
      if (preview !== void 0 && p.startsWith("/_api/")) {
        const docs = docsAt(preview);
        if (!docs) return json(res, 404, { code: "not_found", message: `There is no version ${preview} (it may be too old to keep).` });
        const shown2 = [...docs].filter(([dp]) => reads(viewer, dp));
        if (req.method === "GET" && p === "/_api/events") {
          res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-store", Connection: "keep-alive" });
          res.write("retry: 1500\n\n");
          send(res, "snapshot", { docs: Object.fromEntries(shown2) });
          const ping = setInterval(() => res.write(": ping\n\n"), 25e3);
          req.on("close", () => clearInterval(ping));
          return;
        }
        if (req.method === "GET" && (p === "/_api/doc" || p === "/_api/collection")) {
          let segs;
          try {
            segs = splitPath(url.searchParams.get("path"), p === "/_api/doc" ? "document" : "collection");
            if (segs.length % 2 !== (p === "/_api/doc" ? 0 : 1)) throw new Error(`a ${p === "/_api/doc" ? "document" : "collection"} path has an ${p === "/_api/doc" ? "even" : "odd"} number of segments`);
          } catch (error) {
            return json(res, 400, { code: "invalid_argument", message: error.message });
          }
          const wanted = segs.join("/");
          if (p === "/_api/doc") {
            const data = shown2.find(([dp]) => dp === wanted)?.[1];
            return json(res, 200, data ? { exists: true, data } : { exists: false });
          }
          const prefix = `${wanted}/`;
          return json(res, 200, { docs: Object.fromEntries(shown2.filter(([dp]) => dp.startsWith(prefix) && !dp.slice(prefix.length).includes("/")).map(([dp, data]) => [dp.slice(prefix.length), data])) });
        }
        if (req.method === "POST") {
          req.resume();
          return json(res, 403, { code: "invalid_argument", message: "This is an earlier version: open the current one to change it." });
        }
      }
      if (read && p === "/local-host.js") return serveFile(req, res, path18.join(EDITOR_DIR, "local-host.js"), "text/javascript; charset=utf-8", "no-store");
      if (read && /^\/artifact-type\/[A-Za-z0-9_.-]+$/.test(p)) return serveFile(req, res, path18.join(EDITOR_DIR, p), contentTypeOf(p), "no-cache");
      const blob = /^\/_blob\/([0-9a-f]{32})$/.exec(p);
      if (read && blob) {
        const meta = readBlobMeta(root, blob[1]);
        return serveFile(req, res, blobFile(root, blob[1]), meta?.contentType ?? "application/octet-stream", "private, max-age=31536000, immutable");
      }
      if (req.method === "GET" && p === "/_api/session") {
        return json(res, 200, { ok: true, kind: "motion", ...viewer.guest ? {} : { root }, userId: viewer.user.id, userName: viewer.user.name, role: viewer.role, canEdit: editing });
      }
      if (req.method === "GET" && p === "/_api/events") {
        res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-store", Connection: "keep-alive" });
        res.write("retry: 1500\n\n");
        rescan();
        send(res, "snapshot", { docs: snapshot(viewer) });
        clients.set(res, viewer);
        share2.hold(viewer, res);
        const peer = url.searchParams.get("peer") ?? "";
        const leave = presence.join(PEER_ID.test(peer) ? peer : "", viewer, (text) => res.write(text));
        const ping = setInterval(() => res.write(": ping\n\n"), 25e3);
        req.on("close", () => {
          clearInterval(ping);
          clients.delete(res);
          leave();
        });
        return;
      }
      if (req.method === "GET" && p === "/_api/doc") {
        let doc;
        try {
          doc = readDoc(root, url.searchParams.get("path"));
        } catch (error) {
          return json(res, 400, { code: "invalid_argument", message: error.message });
        }
        return json(res, 200, doc.exists && reads(viewer, doc.path) ? { exists: true, data: doc.data } : { exists: false });
      }
      if (req.method === "GET" && p === "/_api/collection") {
        let segs;
        try {
          segs = splitPath(url.searchParams.get("path"), "collection");
          if (segs.length % 2 !== 1) throw new Error("a collection path has an odd number of segments");
        } catch (error) {
          return json(res, 400, { code: "invalid_argument", message: error.message });
        }
        rescan();
        const prefix = `${segs.join("/")}/`;
        const docs = {};
        for (const [dp, k] of known) if (dp.startsWith(prefix) && !dp.slice(prefix.length).includes("/") && reads(viewer, dp)) docs[dp.slice(prefix.length)] = JSON.parse(k.text);
        return json(res, 200, { docs });
      }
      if (req.method === "POST" && p === "/_api/write") {
        let body;
        try {
          body = JSON.parse((await readBody(req, MAX_BATCH_BYTES + 4096)).toString("utf8"));
        } catch (error) {
          const tooLarge = error instanceof TooLarge;
          return json(res, tooLarge ? 413 : 400, { code: "invalid_argument", message: tooLarge ? "The write is over 1 MB." : "The write is not JSON." });
        }
        let segs;
        try {
          segs = docSegments(body.path);
        } catch (error) {
          return json(res, 400, { code: "invalid_argument", message: error.message });
        }
        if (!editing) return json(res, 403, { code: "invalid_argument", message: "You can view this animation but not change it." });
        if (!dbAccess(viewer, segs).write) return json(res, 403, { code: "invalid_argument", message: `${segs.join("/")} is another person's own: only they read and write it.` });
        let write = { op: body.op, path: body.path, ...body.op === "delete" ? {} : { data: body.data } };
        let merge;
        const base2 = isObject7(body.base) ? body.base : body.base === null && body.op !== "delete" ? {} : null;
        if ((body.op === "set" || body.op === "update" || body.op === "delete") && base2 && !REPLACE_ONLY_DOCS.has(segs.join("/")) && (body.op === "delete" || isObject7(body.data))) {
          let now = null;
          try {
            now = readDoc(root, segs.join("/"));
          } catch {
          }
          if (now && (now.exists || body.base !== null)) {
            const mine = body.op === "delete" ? null : body.op === "update" ? mergePatch(base2, body.data) : body.data;
            const merged = mergeWrite(base2, mine, now.exists ? now.data : null);
            write = merged.result === null ? { op: "delete", path: body.path } : { op: "set", path: body.path, data: merged.result };
            merge = { base: base2, conflicts: merged.conflicts };
          }
        }
        history.attribute(segs.join("/"), whoOf(viewer), merge);
        try {
          const done = applyWrites(root, [write], { agent: false });
          rescan();
          return json(res, 200, { ok: true, writes: done });
        } catch (error) {
          log3(`page write refused: ${error.message}`);
          return json(res, 400, { code: error.code === "REFUSED" ? "resource_exhausted" : "invalid_argument", message: error.message });
        } finally {
          history.settle(segs.join("/"));
        }
      }
      if (req.method === "POST" && p === "/_api/upload") {
        if (!editing) {
          req.resume();
          return json(res, 403, { code: "not_granted", message: "You can view this animation but not add files to it." });
        }
        let bytes;
        try {
          bytes = await readBody(req, MAX_UPLOAD_BYTES);
        } catch (error) {
          const tooLarge = error instanceof TooLarge;
          return json(res, tooLarge ? 413 : 400, { code: "invalid_argument", message: tooLarge ? `The file is over ${kib(MAX_UPLOAD_BYTES)}.` : error.message });
        }
        let name = "upload";
        try {
          name = decodeURIComponent(String(req.headers["x-filename"] ?? "upload")).replace(/[\\/]/g, "_").slice(0, 200) || "upload";
        } catch {
        }
        const type = sniffType(bytes) ?? (String(req.headers["content-type"] ?? "") || contentTypeOf(name));
        const result = putBlob(root, bytes, name, type);
        log3(`uploaded ${name} as ${result.url}${viewer.guest ? ` (${viewer.user.name})` : ""}`);
        return json(res, 200, result);
      }
      if (p === "/__comments" || p.startsWith("/__comments/")) {
        const sub = p.slice("/__comments".length);
        if (sub === "/events") share2.hold(viewer, res);
        return await comments.handle(req, res, sub);
      }
      return json(res, 404, { code: "not_found", message: "Not found" });
    } catch (error) {
      log3(`error: ${error.stack ?? error}`);
      if (!res.headersSent) json(res, 500, { code: "unavailable", message: String(error.message ?? error) });
    }
  }
  const close = () => {
    clearInterval(poll);
    watcher?.close();
    for (const c of clients.keys()) c.end();
    comments.close();
    share2.close();
    presence.close();
  };
  return {
    root,
    page,
    share: share2,
    handle,
    // The page's assets, for a frame (an opaque origin) that asks by a root-relative address.
    common: (pathname) => /^\/(assets|artifact-type)\//.test(pathname),
    hasBlob: (id) => fs19.existsSync(blobFile(root, id)),
    close
  };
}
var fail2 = (code, message) => {
  throw new CliError(code, message);
};
var shareCall2 = (url, action) => shareCall(url, action, fail2);
var lanOn2 = (url, flags) => lanOn(url, flags, fail2);
async function open(root, flags) {
  const existing = await runningServer2(root);
  if (existing) {
    print({ url: existing.url, root, pid: existing.pid, reused: true, ...await lanOn2(existing.url, flags), log: path18.join(root, LOG_FILE), stop: cmd("stop", root) }, true);
    return;
  }
  const state = await startBackground(root, flags);
  const empty = !fs19.existsSync(docFile(root, ["film", "script"]));
  print({ url: state.url, root, pid: state.pid, ...state.lan?.length ? { lan: state.lan } : {}, log: path18.join(root, LOG_FILE), stop: cmd("stop", root), ...empty ? { note: 'film/script is not written yet: the page shows "No animation yet" until it is.' } : {} }, true);
}
async function startBackground(root, flags) {
  const port = flags.has("port") ? Number(flags.get("port")) : DEFAULT_PORTS.motion;
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new CliError("INVALID_PORT", "--port is a number from 0 to 65535.");
  const agentHook = flags.get("agent-hook");
  const opened = await openOnHub({
    kind: "motion",
    script: SCRIPT,
    root,
    port,
    portGiven: flags.has("port"),
    host: flags.get("host") ?? "127.0.0.1",
    ...agentHook && agentHook !== "true" ? { agentHook } : {},
    lan: flags.has("lan"),
    command: [SCRIPT, "serve", root, ...serverFlags(flags)],
    running: () => runningServer2(root)
  });
  if ("state" in opened) {
    const view = await shareCall2(opened.state.url, null).catch(() => null);
    return { ...opened.state, ...view?.lan ? { lan: lanUrls(view) } : {} };
  }
  throw new CliError("SERVER_FAILED", `The player server did not start. Run ${cmd("serve", root)} in the foreground to see why.${opened.tail ? `
${opened.tail}` : ""}`);
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
      fail: fail2
    })
  );
}
async function stop(root) {
  const state = readState(root);
  if (!state || !alive(state.pid)) {
    fs19.rmSync(path18.join(root, STATE_FILE), { force: true });
    print({ stopped: false, message: "No player server is running for this folder." }, true);
    return;
  }
  if (!await leaveHub(state)) {
    print({ stopped: false, pid: state.pid, message: `The server did not exit within 5 s; end it with: kill ${state.pid}` }, true);
    return;
  }
  print({ stopped: true, pid: state.pid }, true);
}
var WAIT_CHUNK_S = 300;
var commentHints = (root) => ({ reply: cmd("comment-reply", root, "<id>", "<text>"), resolve: cmd("comment-resolve", root, "<id>") });
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
var REQUESTS_HINT = (
  // BaoCut: the player's button is "Ask Agent" (motion-runtime names the agent "Agent").
  "Each request is one of the player's buttons (Continue, Finalize, Make the animation, Ask Agent) asking you for that: its words are the user's, as if pasted in the chat. Handle it as SKILL.md says for those words, then wait again."
);
async function waitComments(root, flags) {
  const timeout = flags.has("timeout") ? Number(flags.get("timeout")) : Infinity;
  if (!(timeout > 0)) throw new CliError("INVALID_TIMEOUT", "--timeout is a number of seconds above 0.");
  const deadline = Date.now() + timeout * 1e3;
  let failures = 0;
  for (; ; ) {
    const state = await runningServer2(root);
    if (!state) throw new CliError("NO_SERVER", `No player server is running for this folder: start it with ${cmd("open", root)}, then wait again.`);
    const left = Math.min(WAIT_CHUNK_S, (deadline - Date.now()) / 1e3);
    if (left <= 0) return { root, threads: [], timedOut: true, next: cmd("comments", root, "--wait") };
    let body;
    try {
      const response = await fetch(new URL(`__comments/agent/wait?timeout=${Math.max(1, Math.round(left))}`, state.url), {
        // A whole number of ms: AbortSignal.timeout refuses a fraction (and --timeout leaves one in `left`).
        signal: AbortSignal.timeout(Math.ceil((left + 30) * 1e3))
      });
      if (response.status === 404) {
        throw new CliError("SERVER_OUTDATED", `The running player server has no comments (an older version started it). Restart it: ${cmd("stop", root)}, then ${cmd("open", root)}.`);
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      body = await response.json();
      failures = 0;
    } catch (error) {
      if (error instanceof CliError) throw error;
      if (++failures >= 3) throw new CliError("SERVER_GONE", `Lost the player server: ${error.message}`);
      await new Promise((resolve) => setTimeout(resolve, 1e3));
      continue;
    }
    if (body.closed) continue;
    const threads = body.threads ?? [];
    const requests = body.requests ?? [];
    if (threads.length || requests.length) {
      return {
        root,
        url: state.url,
        title: filmTitle(root),
        file: commentsPath(root),
        threads,
        ...threads.length ? commentHints(root) : {},
        ...requests.length ? { requests, about: REQUESTS_HINT } : {},
        next: cmd("comments", root, "--wait")
      };
    }
  }
}
function filmTitle(root) {
  try {
    const meta = readDoc(root, "film/meta");
    const title = meta.exists && typeof meta.data?.title === "string" ? meta.data.title.trim() : "";
    return title || path18.basename(root);
  } catch {
    return path18.basename(root);
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
function listSystems(dirs) {
  const extra = (process.env.CLAUDE_DESIGN_SYSTEMS ?? "").split(path18.delimiter).filter(Boolean);
  const starts = [...dirs.length > 0 ? dirs : [process.cwd()], ...extra].map((d) => path18.resolve(d));
  const skip = /* @__PURE__ */ new Set(["node_modules", "dist", "build", "out", "vendor", "target", "project"]);
  const found = /* @__PURE__ */ new Map();
  const indexOf = (dir) => {
    const file = path18.join(dir, "project", "design-system.json");
    const stat = fs19.lstatSync(file, { throwIfNoEntry: false });
    if (!stat?.isFile() || stat.size > 8 * 1024 * 1024) return null;
    try {
      const index = JSON.parse(fs19.readFileSync(file, "utf8"));
      if (!isObject7(index) || isObject7(index.content)) return null;
      const marked = isObject7(index.createdOnFiles) || isObject7(index.convertedFrom) || typeof index.v === "number" && index.v >= 3 && index.layout === "files";
      return marked ? index : null;
    } catch {
      return null;
    }
  };
  const visit = (dir, depth) => {
    const index = found.has(dir) ? null : indexOf(dir);
    if (index) {
      const title = typeof index.title === "string" && index.title.trim() ? index.title.trim() : path18.basename(dir);
      const tokens = path18.join(dir, "project", "tokens.json");
      found.set(dir, { title, root: dir, tokens: fs19.existsSync(tokens) ? tokens : null });
      return;
    }
    if (depth <= 0) return;
    let entries = [];
    try {
      entries = fs19.readdirSync(dir, { withFileTypes: true });
    } catch {
    }
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith(".") && !skip.has(entry.name)) visit(path18.join(dir, entry.name), depth - 1);
    }
  };
  for (const start of starts) visit(start, 4);
  return [...found.values()];
}
var USAGE = `claude-motion \u2014 local Artifact tool for the Motion type (a film)

Usage:
  node scripts/artifact.mjs write-db <root> <batch.json | ->     write documents (set / update / delete), all or nothing
  node scripts/artifact.mjs read-db  <root> [<collection>[/<doc_id>]] [--text]
                                                                  read the store; --text prints a module's text (its
                                                                  parts joined) or the script's code, raw
  node scripts/artifact.mjs upload   <root> <file> [--name n]    upload an image, font, clip or voice take (mp3, wav);
                                                                  prints its /_blob/<id> url
  node scripts/artifact.mjs delete-asset <root> <url|id>         remove an upload nothing names any more
  node scripts/artifact.mjs check    <root>                      check the documents, the cut's syntax, scenes.json and
                                                                  voice.json (each take measured against its speech);
                                                                  exit 1 on problems
  node scripts/artifact.mjs voice    <root> [--only id,\u2026] [--force] [--dry-run]
                                     [--provider p] [--model m] [--voice v] [--style s] [--speed x] [--command "\u2026"]
                                     [--format mp3|wav|keep]
                                                                  a take for each scene of voice.json from a text-to-speech
                                                                  provider: uploads it, fills audio, speech and hash;
                                                                  skips takes still up to date (see Voice track below)
  node scripts/artifact.mjs voice    --providers                 which providers could make takes here (a key or
                                                                  MOTION_TTS_COMMAND set), what each needs, its speeds;
                                                                  on a Mac with say and ffmpeg, the command that makes
                                                                  draft takes with its own voices (macos)
  node scripts/artifact.mjs voice    <root> --take id=file[,id=file\u2026] | --takes <dir> [--format mp3|wav|keep] [--dry-run]
                                                                  adopt takes made elsewhere (another speech tool, a
                                                                  recording; <dir>/<id>.mp3 or .wav): uploaded, measured
                                                                  and hashed as voice's own, so check sees a stale one
  node scripts/artifact.mjs align    <root> [--only id,\u2026] [--force] [--aligner silence|command] [--command "\u2026"]
                                                                  when each character is said in its take: fills chars
  node scripts/artifact.mjs sync     <root> [--dry-run]          speech from each take's length, and each scene's dur in
                                                                  scenes.json from speech + gap (+ its hold)
  node scripts/artifact.mjs beats    <root> [--only id,\u2026] [--words] [--text]
                                                                  when each line of voice.json is said (kit.cue's numbers,
                                                                  in the scene's seconds, and its start in the film), and
                                                                  with --words each word (t, and f for kit.beat), as the
                                                                  player times them; --text: a table to read
  node scripts/artifact.mjs export   <root> [--out file.mp4] [--height n] [--fps n] [--quality low|medium|high]
                                     [--supersample] [--timeout s] [--captions [srt|vtt]]
                                     [--audio-only] [--out file.wav|.mp3|.m4a]
                                                                  --audio-only (or --no-video): the sound alone (voice,
                                                                  score, music beds), in seconds, as a wav
                                                                  the film as a video (voice, music and all) from the
                                                                  player's own export in a headless Chrome, no page open;
                                                                  --height is the short side (default the film's);
                                                                  beside the film in exports/ unless --out says;
                                                                  --captions: its captions in a file beside it
  node scripts/artifact.mjs record   --url u --out clip.mp4 [--steps f.json] [--size 1440x900] [--scale 2] [--tail s]
                                                                  A page of their product, driven by steps in a headless
                                                                  Chrome, as a clip; prints when each step happened
  node scripts/artifact.mjs stills   <root> --at 2.5,s03,s03+1.2 | --scenes | --every s [--width n] [--format png|jpeg]
                                     [--out dir]                 the frames the film shows at those moments (seconds, a
                                                                  scene's middle, a time in a scene), from the player in a
                                                                  headless Chrome; 960 wide unless --width; in
                                                                  exports/stills/ unless --out says, numbered on from
                                                                  the stills already there
  node scripts/artifact.mjs captions <root> [--format srt|vtt] [--out file]
                                                                  the captions the player shows, timed as the film plays,
                                                                  as a file (exports/captions.srt unless --out says)
  node scripts/artifact.mjs score    <root> [--levels]           what score.js plays, from the player in a headless
                                                                  Chrome: the names the synth doesn't know (silent, or
                                                                  played as marimba), tempo, span; the sound rendered as
                                                                  the export does: loudness, the voice's level, the music
                                                                  between the lines, quiet seconds; --levels: each
                                                                  second's level too; beds: the recorded music S.bed
                                                                  plays; cuts: each scene's start on S.tempo's grid.
                                                                  Writes nothing
  node scripts/artifact.mjs music    <file> [--bpm n] [--step s] a music file measured: length, silence at the start
                                                                  and end, loudness, tempo and where its first beat
                                                                  falls (estimated unless --bpm), level every 4 s
  node scripts/artifact.mjs arrange  --in <music> --bpm n [--t0 s] --map <file|json|-> [--out bed.wav]
                                     [--beats-per-bar 4] [--xfade 0.03] [--fade-out 1] [--length s]
                                                                  a track cut to the film: pieces of it, in bars of its
                                                                  tempo, placed at film seconds, crossfaded on the cuts:
                                                                  [{"at": 0, "bar": 1, "bars": 8}, {"at": 16, "bar": 17,
                                                                  "bars": 4}]; a wav is read and written here, anything
                                                                  else through ffmpeg
  node scripts/artifact.mjs open     <root> [--port n] [--lan]   start the player in the background; prints {"url"}
  node scripts/artifact.mjs serve    <root> [--port n] [--lan]   the same server, in the foreground
                                     [--agent-hook "<command>"]  open/serve: run this for each comment sent to the agent
                                                                  (the comment as JSON on stdin); --lan: shared too
  node scripts/artifact.mjs stop     <root>                      stop the background player
  node scripts/artifact.mjs share    <root>                      share on the local network; prints a link per role
                                     [--off] [--reset R] [--enable R] [--disable R]
                                                                  R: editor, commenter, viewer, a comma list, or all
                                     [--role G=R,...]            give guest G (an id it prints) role R
                                                                  (link options only: shared or not stays as it was)
  node scripts/artifact.mjs comments <root> [--all]              the open comments people left in the player (--all:
                                                                  resolved too)
  node scripts/artifact.mjs comments <root> --wait [--timeout s] wait for a comment sent to the agent from the open player, or a request from its buttons
  node scripts/artifact.mjs comment-reply <root> <id> <text|-> [--resolve]
                                                                  reply as the agent (-: text on stdin)
  node scripts/artifact.mjs comment-resolve <root> <id> [--reopen]
                                                                  mark a comment resolved (or open again)
  node scripts/artifact.mjs list     [dir \u2026]                     the design systems here (and in $CLAUDE_DESIGN_SYSTEMS):
                                                                  each {title, root, tokens}
  node scripts/artifact.mjs archive  <root> [--out file.zip|dir] the whole folder as one zip (backup, another computer,
                                                                  someone else); beside the folder unless --out says
  node scripts/artifact.mjs import-explainer <project> <root> [--v zh] [--size WxH]
                                                                  an explainer project (JS + Canvas: script, timings,
                                                                  audio/, film-core.js, index.html), one variant, as a
                                                                  new film: its takes and words as voice.json, its own
                                                                  engine drawing each scene; then checks it

<root> is the film's folder: documents at <root>/db/<collection>/<doc_id>.json, uploads in <root>/_blobs/,
comments in <root>/comments.json, the share links and guests in <root>/.sharing.json.
A batch is a JSON array (or {"writes": [...]}) of {op, path: "collection/doc_id" (or collection + doc_id), data | file_path};
in data, {"$file": "path"} is replaced by that file's text. update merges fields; null or {"__delete__": true} removes one.
Paths in a batch are relative to the current directory.

Voice track: voice takes the provider, model, voice and style from its flags, else from voice.json "voice"
{provider, model, name, style}, and writes back what it used; it never picks a voice. Providers and their keys, read
from the environment only (never written to the film or printed):
  gemini      GEMINI_API_KEY or GOOGLE_API_KEY (GEMINI_BASE_URL); --model and --voice needed, --style optional
  openai      OPENAI_API_KEY, any OpenAI-compatible /audio/speech (OPENAI_BASE_URL); --model and --voice needed
  elevenlabs  ELEVENLABS_API_KEY (ELEVENLABS_BASE_URL); --voice is the voice id, --model optional
  command     your own program: --command or MOTION_TTS_COMMAND, run by the shell with the text on stdin and in
              $MOTION_TTS_TEXT_FILE ($MOTION_TTS_TEXT keeps <markers>; $MOTION_TTS_LANG, _VOICE, _MODEL, _STYLE,
              _SPEED); it writes a wav or mp3 to $MOTION_TTS_OUT
--speed is the pace as a factor (1.1 a little faster): openai 0.25\u20134, elevenlabs 0.7\u20131.2, command 0.25\u20134; gemini has
none (ask for the pace in --style). It is kept in voice.json voice.speed; --speed none drops it.
A take is an mp3 when ffmpeg is here. align's silence aligner (the default) matches the take's pauses to the lines'
breaks; --aligner command (or --command, or MOTION_ALIGN_COMMAND) runs your own, such as a speech recogniser: the take
as a 16 kHz wav in $MOTION_ALIGN_AUDIO, the text in $MOTION_ALIGN_TEXT_FILE, JSON on stdin; it prints {"chars": [...]}
or {"words": [{"text", "start", "end"}]}. export runs CHROME_PATH, else the Chrome it finds.
Skill: ${SKILL_DIR}`;
async function main() {
  const [command2, ...rest] = process.argv.slice(2);
  const { positional, flags } = parseArgs(rest);
  switch (command2) {
    case "write-db": {
      const root = resolveRoot(positional[0], { create: true });
      const from = positional[1];
      if (!from) throw new CliError("MISSING_BATCH", "Give the batch: a JSON file, or - to read it from stdin.");
      let text;
      try {
        text = from === "-" ? fs19.readFileSync(0, "utf8") : fs19.readFileSync(path18.resolve(from), "utf8");
      } catch {
        throw new CliError("FILE_NOT_FOUND", `No such batch file: ${from}`);
      }
      let batch;
      try {
        batch = JSON.parse(text);
      } catch (error) {
        throw new CliError("INVALID_BATCH", `The batch is not JSON: ${error.message}`);
      }
      const writes = Array.isArray(batch) ? batch : Array.isArray(batch?.writes) ? batch.writes : isObject7(batch) && batch.op ? [batch] : null;
      if (!writes) throw new CliError("INVALID_BATCH", 'A batch is an array of writes, or {"writes": [...]}.');
      const written = applyWrites(root, writes);
      const server = readState(root);
      print({ root, written, ...server && alive(server.pid) ? { note: "The open player picks the change up by itself." } : {} });
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
    case "voice":
      if (flags.has("providers")) {
        print(providersCommand());
        return 0;
      }
      print(await voiceCommand(filmStore(resolveRoot(positional[0])), flags));
      return 0;
    case "align":
      print(await alignCommand(filmStore(resolveRoot(positional[0])), flags));
      return 0;
    case "sync":
      print(syncCommand(filmStore(resolveRoot(positional[0])), flags));
      return 0;
    case "beats": {
      const out = beatsCommand(filmStore(resolveRoot(positional[0])), flags);
      if (typeof out === "string") process.stdout.write(`${out}
`);
      else print(out);
      return 0;
    }
    case "export":
      print(await exportCommand(filmStore(resolveRoot(positional[0])), flags));
      return 0;
    case "record":
      print(await recordCommand(flags));
      return 0;
    case "stills":
      print(await stillsCommand(filmStore(resolveRoot(positional[0])), flags));
      return 0;
    case "captions":
      print(await captionsCommand(filmStore(resolveRoot(positional[0])), flags));
      return 0;
    case "score":
      print(await scoreCommand(filmStore(resolveRoot(positional[0])), flags));
      return 0;
    case "music":
      print(await musicCommand(positional[0], flags));
      return 0;
    case "arrange":
      print(await arrangeCommand(flags));
      return 0;
    case "open":
      await open(resolveRoot(positional[0], { create: true }), flags);
      return 0;
    case "serve":
      return await serve(resolveRoot(positional[0], { create: true }), flags) ? -1 : 0;
    case "stop":
      await stop(resolveRoot(positional[0]));
      return 0;
    case "share":
      await share(resolveRoot(positional[0]), flags);
      return 0;
    case "list":
      print({ designSystems: listSystems(positional) });
      return 0;
    case "comments": {
      const root = resolveRoot(positional[0]);
      print(flags.has("wait") ? await waitComments(root, flags) : await listComments(root, flags.has("all")));
      return 0;
    }
    case "comment-reply":
      print(await replyComment(resolveRoot(positional[0]), positional[1], positional.slice(2), flags.has("resolve")));
      return 0;
    case "comment-resolve":
      print(await resolveComment(resolveRoot(positional[0]), positional[1], flags.has("reopen")));
      return 0;
    case "import-explainer": {
      const made = importExplainer(positional[0], positional[1], flags);
      print(made);
      return made.check.problems > 0 ? 1 : 0;
    }
    case "archive": {
      const made = await archiveCommand(resolveRoot(positional[0]), flags.get("out"));
      print({ ...made, open: `unzip it anywhere, then ${cmd("open", `<there>/${made.folder}`)}` });
      return 0;
    }
    case void 0:
    case "help":
    case "--help":
    case "-h":
      process.stdout.write(`${USAGE}
`);
      return command2 === void 0 ? 2 : 0;
    default:
      process.stderr.write(`Unknown command: ${command2}

${USAGE}
`);
      return 2;
  }
}
if (typeof __BAOBOT_LIB__ === "undefined") main().then(
  (code) => {
    if (code >= 0) process.exitCode = code;
  },
  (error) => {
    process.stderr.write(`${JSON.stringify({ error: error.code ?? "ERROR", message: error.message })}
`);
    process.exitCode = 2;
  }
);
export {
  applyWrites,
  check,
  mountSite,
  readDb,
  upload
};
