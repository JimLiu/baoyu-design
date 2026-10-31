#!/usr/bin/env node
// claude-design-system: local editor server (prebuilt; do not edit).

import os4 from "node:os";

import { createHash as createHash2, randomBytes, randomUUID } from "node:crypto";
import fs6 from "node:fs";
import fsp2 from "node:fs/promises";
import http from "node:http";
import path5 from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { spawn } from "node:child_process";
import fs2 from "node:fs";
import os from "node:os";

var COMMENTS_FILE = "comments.json";
var COMMENTS_VERSION = 1;
var LIMITS = { text: 1e4, label: 1e3, detail: 4e3, anchor: 2048, section: 200, name: 100 };
function sameAuthor(a, b) {
  return a.kind === "user" && b.kind === "user" && (a.principal ?? "") === (b.principal ?? "");
}
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
var isRecord = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
var isText = (v, max) => typeof v === "string" && v.length <= max;
function cleanText(v) {
  if (typeof v !== "string") return null;
  const text = v.replace(/\r\n?/g, "\n").trim();
  return text !== "" && text.length <= LIMITS.text ? text : null;
}
function readNewThread(body) {
  if (!isRecord(body)) return null;
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
  if (!isRecord(body)) return null;
  const text = cleanText(body.text);
  if (text === null) return null;
  if (body.send !== void 0 && typeof body.send !== "boolean") return null;
  return { text, ...body.send ? { send: true } : {} };
}
var readEdit = readReply;
function readStatus(body) {
  return isRecord(body) && (body.status === "open" || body.status === "resolved") ? body.status : null;
}
function readAgentRequest(body) {
  if (!isRecord(body)) return null;
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
  if (!isRecord(data) || data.version !== COMMENTS_VERSION || !Array.isArray(data.threads)) {
    throw new CommentsError("COMMENTS_FILE_INVALID", `not a version ${COMMENTS_VERSION} comments file (expected {"version": 1, "threads": [...]})`, 500);
  }
  const threads = data.threads.filter(
    (t) => isRecord(t) && typeof t.id === "string" && typeof t.anchor === "string" && typeof t.label === "string" && (t.status === "open" || t.status === "resolved") && Array.isArray(t.messages) && t.messages.every((m) => isRecord(m) && typeof m.text === "string" && isRecord(m.author) && (m.author.kind === "user" || m.author.kind === "agent"))
  );
  for (const t of threads) {
    if (!isRecord(t.location)) t.location = {};
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
  const open = openThreads(doc);
  return threads.map((t) => {
    const i = open.indexOf(t);
    return agentView(t, i >= 0 ? i + 1 : void 0);
  });
}
function projectFile(rel) {
  if (!rel) return void 0;
  const body = rel.endsWith("/") ? rel.slice(0, -1) : rel;
  const parts = body.split("/");
  if (!parts.every((part) => part !== "" && part !== ".." && !part.startsWith(".") && !part.includes("\\"))) return void 0;
  return `project/${rel}`;
}

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
var LOCK_STALE_MS = 1e4;
var LOCK_WAIT_MS = 5e3;
var LOCK_RETRY_MS = 20;
var commentsPath = (root) => path.join(root, COMMENTS_FILE);
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
  const temp = path.join(path.dirname(file), `.${path.basename(file)}.${process.pid}.${Date.now().toString(36)}.tmp`);
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
    const exists = fs.existsSync(commentsPath(root));
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
var TooLarge = class extends Error {
};
function sendJson(response, status, body) {
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
        reject(new TooLarge());
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
    return os.userInfo().username.trim() || "you";
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
    if (!waiter.response.writableEnded) sendJson(waiter.response, 200, body);
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
    watcher = fs2.watch(root, (_event, name) => {
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
    fs2.stat(commentsPath(root), (error, info) => {
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
    sendJson(response, 201, { thread: created });
    await afterChange(Boolean(input.send));
  }
  async function ask(request, response) {
    const input = readAgentRequest(await readJson(request));
    if (!input) throw new CommentsError("INVALID_REQUEST", "expected {text} with a non-empty text");
    if (!presence().available) throw new CommentsError("AGENT_UNAVAILABLE", "no agent is waiting: copy the request for the chat instead", 409);
    const queued = { id: newId("r"), ...input, sentAt: now() };
    requests.push(queued);
    log(`comments: request ${queued.id}${input.label ? ` (${input.label})` : ""} for the agent`);
    sendJson(response, 202, { request: queued });
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
        if (reading) return sendJson(response, 200, await snapshot(viewer));
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
          sendJson(response, 200, { thread: t });
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
          sendJson(response, 200, { deleted: id });
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
          sendJson(response, 200, { thread: t });
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
          sendJson(response, 200, { thread: t });
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
          sendJson(response, 200, { thread: t });
          return await afterChange(true);
        }
      } else {
        return sendJson(response, 404, { code: "NOT_FOUND", message: "no such comments route" });
      }
      request.resume();
      sendJson(response, 405, { code: "METHOD_NOT_ALLOWED", message: `${method} is not allowed here` });
    } catch (error) {
      if (response.headersSent) throw error;
      if (error instanceof CommentsError) return sendJson(response, error.status, { code: error.code, message: error.message });
      if (error instanceof TooLarge) return sendJson(response, 413, { code: "TOO_LARGE", message: "request body is too large" });
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

import fs3 from "node:fs";
import net from "node:net";
import os2 from "node:os";
import path2 from "node:path";
var STATE_FILE = ".artifact-server.json";
function readState(root) {
  try {
    return JSON.parse(fs3.readFileSync(path2.join(root, STATE_FILE), "utf8"));
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
  const file = path2.join(state.root, STATE_FILE);
  fs3.writeFileSync(file, `${JSON.stringify(state, null, 2)}
`);
  const shutdown = () => {
    if (readState(state.root)?.pid === process.pid) fs3.rmSync(file, { force: true });
    close();
    process.exit(0);
  };
  for (const signal of signals) process.on(signal, shutdown);
}
async function listen(server2, port, host) {
  await new Promise((resolve, reject) => {
    server2.once("error", reject);
    server2.listen(port, host, () => resolve());
  });
  const address = server2.address();
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
  for (const list of Object.values(os2.networkInterfaces())) {
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
async function listenFree(server2, from, host, first) {
  if (from === 0) return listen(server2, 0, host);
  const to = Math.min(from + PORT_TRIES - 1, 65535);
  const range = Array.from({ length: to - from + 1 }, (_, i) => from + i);
  const ports = first ? [first, ...range.filter((port) => port !== first)] : range;
  const wildcard = host === "0.0.0.0" || host === "::";
  const probes = [.../* @__PURE__ */ new Set([...wildcard ? [] : [host], "127.0.0.1", "::1", ...lanAddresses()])];
  for (const port of ports) {
    if ((await Promise.all(probes.map((address) => answers(address, port)))).some(Boolean)) continue;
    try {
      return await listen(server2, port, host);
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
function sendJson2(response, status, body, headers = {}) {
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
var TooLarge2 = class extends Error {
};
function readBody(request, limit) {
  return new Promise((resolve, reject) => {
    const declared = Number(request.headers["content-length"]);
    if (Number.isFinite(declared) && declared > limit) {
      reject(new TooLarge2());
      request.resume();
      return;
    }
    const chunks = [];
    let size = 0;
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new TooLarge2());
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
  const stream = fs3.createReadStream(file);
  stream.on("error", () => response.destroy());
  response.on("close", () => stream.destroy());
  stream.pipe(response);
}
var errorText = (error) => error instanceof Error ? error.message : String(error);

import { createHash } from "node:crypto";
import fs5 from "node:fs";
import os3 from "node:os";
import path4 from "node:path";

import crypto from "node:crypto";
import fs4 from "node:fs";
import path3 from "node:path";
var GUEST_ROLES = ["editor", "commenter", "viewer"];
var isGuestRole = (value) => typeof value === "string" && GUEST_ROLES.includes(value);
var SHARING_FILE = ".sharing.json";
var MAX_GUESTS = 200;
var MAX_NAME = 40;
var token = (bytes = 18) => crypto.randomBytes(bytes).toString("base64url");
var isRecord2 = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
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
    this.file = path3.join(root, SHARING_FILE);
    this.state = _Sharing.read(this.file);
  }
  static read(file) {
    let raw;
    try {
      raw = JSON.parse(fs4.readFileSync(file, "utf8"));
    } catch {
      return fresh();
    }
    const state = fresh();
    if (!isRecord2(raw)) return state;
    state.lan = raw.lan === true;
    if (typeof raw.port === "number" && Number.isInteger(raw.port) && raw.port > 0 && raw.port < 65536) state.port = raw.port;
    if (isRecord2(raw.links)) {
      for (const role of GUEST_ROLES) {
        const link = raw.links[role];
        if (isRecord2(link) && typeof link.token === "string" && link.token.length >= 16) state.links[role] = { token: link.token, on: link.on !== false };
      }
    }
    if (Array.isArray(raw.guests)) {
      for (const g of raw.guests) {
        if (!isRecord2(g) || typeof g.id !== "string" || typeof g.secret !== "string" || !isGuestRole(g.role) || typeof g.link !== "string") continue;
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
    fs4.writeFileSync(tmp, `${JSON.stringify(this.state, null, 2)}
`, { mode: 384 });
    fs4.renameSync(tmp, this.file);
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
var isRecord3 = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
var esc = (text) => text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
var script = (value) => JSON.stringify(value).replace(/</g, "\\u003c");
function ownHosts(host, port) {
  const named = host === "0.0.0.0" || host === "::" ? [] : [host.includes(":") ? `[${host}]:${port}` : `${host}:${port}`];
  return [.../* @__PURE__ */ new Set([`127.0.0.1:${port}`, `localhost:${port}`, `[::1]:${port}`, ...named])];
}
function localOwner() {
  let name = "You";
  try {
    name = os3.userInfo().username.trim() || name;
  } catch {
  }
  return { id: "local", name, email: `${name}@localhost` };
}
var guestCookieName = (kind, root) => `${kind.replace(/-/g, "_")}_guest_${createHash("sha256").update(path4.resolve(root)).digest("hex").slice(0, 12)}`;
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
  async listen(server2, { port, host, lan = false, portGiven = false }) {
    const { state } = this.sharing;
    const linksPort = !portGiven && (lan || state.lan) && state.port ? state.port : void 0;
    const taken = await listenFree(server2, port, host, linksPort);
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
    const machine = os3.hostname().toLowerCase();
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
      const server2 = this.options.createServer();
      try {
        await listen(server2, this.port, address);
        this.lanServers.set(address, server2);
      } catch (error) {
        server2.close();
        this.options.log(`not listening on ${address}:${this.port}: ${error.message}`);
      }
    }
    if (!this.sharing.state.lan || this.sharing.state.port !== this.port) this.sharing.setLan(true, this.port);
    this.options.log(`shared on the local network: ${[...this.lanServers.keys()].map((a) => `http://${a}:${this.port}/`).join(", ") || "(no LAN address)"}`);
    return [...this.lanServers.keys()];
  }
  closeLan() {
    for (const server2 of this.lanServers.values()) {
      server2.close();
      server2.closeAllConnections?.();
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
      sendJson2(response, 403, { code: "not_granted", message: "Cross-origin write refused." });
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
    if (method === "GET" && p === "/__share/me") return sendJson2(response, 200, this.me(viewer)), true;
    if (method === "GET" && p === "/__share/boot.js") {
      const body = this.bootScript(viewer);
      response.writeHead(200, { "Content-Type": "text/javascript; charset=utf-8", "Content-Length": Buffer.byteLength(body), "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" }).end(body);
      return true;
    }
    if (method === "GET" && p === "/__share/invite") return sendJson2(response, 200, this.invites(viewer, request.headers.host ?? "")), true;
    if (method === "GET" && p === "/__share/ui.js") {
      fs5.stat(this.options.uiFile, (error, stat) => {
        if (error || !stat.isFile()) return sendJson2(response, 404, { code: "not_found", message: "The Share panel is missing." });
        sendFile(request, response, this.options.uiFile, { "Content-Type": "text/javascript; charset=utf-8", "Content-Length": stat.size, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
      });
      return true;
    }
    if (viewer.role !== "owner") return sendJson2(response, 403, { code: "not_granted", message: "Only the owner can do this." }), true;
    if (p === "/__share") return await this.shareApi(request, response, method), true;
    sendJson2(response, 404, { code: "not_found", message: "Not found" });
    return true;
  }
  /** The tags a page puts first in its <head>: the boot script and the Share panel (the owner's, or a guest's). */
  headTags(_viewer) {
    let tags = '<script src="/__share/boot.js"></script>';
    if (fs5.existsSync(this.options.uiFile)) tags += '<script type="module" src="/__share/ui.js"></script>';
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
    const share = { ...this.me(viewer), noun: this.options.noun, title: this.options.title(), ...this.options.reactions ? { reactions: true } : {} };
    let js = `${SECURE_CONTEXT_SHIM}window.__baoyuShare=${script(share)};`;
    for (const [name, value] of Object.entries(this.options.globals?.(viewer) ?? {})) js += `window[${script(name)}]=${script(value)};`;
    if (viewer.guest) js += GUEST_WATCH;
    return js;
  }
  /** Nobody's request: a page for a browser's navigation, JSON for anything else. */
  denied(request, response) {
    request.resume();
    const navigation = (request.method === "GET" || request.method === "HEAD") && /\btext\/html\b/.test(request.headers.accept ?? "");
    if (!navigation) return sendJson2(response, 403, { code: "not_granted", message: `This ${this.options.noun.en} is not shared with you.` });
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
    if (method === "GET") return sendJson2(response, 200, this.shareView());
    if (method !== "POST") return sendJson2(response, 405, { code: "method_not_allowed", message: `${method} is not allowed here.` });
    let action;
    try {
      action = JSON.parse((await readBody(request, 64 << 10)).toString("utf8"));
    } catch {
      return sendJson2(response, 400, { code: "invalid_argument", message: "The call is not JSON." });
    }
    if (!isRecord3(action)) return sendJson2(response, 400, { code: "invalid_argument", message: "Expected {action, ...}." });
    try {
      return sendJson2(response, 200, await this.share(action));
    } catch (error) {
      if (error instanceof ShareError) return sendJson2(response, 400, { code: "invalid_argument", message: error.message });
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

var KIND = "";
var NOUN = "";
var INDEX_FILE = "";
var LAYOUT;
var pageScriptSrc;
var sessionExtras;
var commentLocation;
var SCRIPT = "";
var EDITOR_DIR = "";
var MIME = {
  html: "text/html",
  htm: "text/html",
  json: "application/json",
  css: "text/css",
  js: "text/javascript",
  mjs: "text/javascript",
  md: "text/markdown",
  txt: "text/plain",
  xml: "application/xml",
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  ico: "image/x-icon",
  woff2: "font/woff2",
  woff: "font/woff",
  ttf: "font/ttf",
  otf: "font/otf",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  pdf: "application/pdf",
  wasm: "application/wasm"
};
var EXT_BY_MIME = {
  "image/svg+xml": "svg",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/avif": "avif",
  "font/woff2": "woff2",
  "font/woff": "woff",
  "font/ttf": "ttf",
  "font/otf": "otf",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
  "image/x-icon": "ico",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "application/pdf": "pdf"
};
var STATIC_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
  ".wasm": "application/wasm",
  ".map": "application/json; charset=utf-8"
};
var ROUTES = {
  listing: "_files.json",
  publish: "__deck/publish",
  assets: "__deck/assets",
  events: "__deck/events",
  session: "__deck/session"
};
var COMMENTS_ROUTE = "__comments";
var ASSET_INDEX = "index.json";
var BLOB_ID = /^[0-9a-f]{32}$/;
var BLOB_PATH = /^_blob\/([0-9a-f]{32})$/;
var DATA_CSP = "sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data:";
var MAX_PUBLISH_BYTES = 64 * 1024 * 1024;
var MAX_ASSET_BYTES = 256 * 1024 * 1024;
var SSE_KEEPALIVE_MS2 = 25e3;
var WATCH_DEBOUNCE_MS2 = 300;
var POLL_MS2 = 2e3;
var CHANGE_LOG_SIZE = 64;
var CLIENT_ID = /^[A-Za-z0-9_-]{8,64}$/;
var sha256 = (bytes) => createHash2("sha256").update(bytes).digest("hex");
function contentTypeOf(file) {
  const ext = file.slice(file.lastIndexOf(".") + 1).toLowerCase();
  return MIME[ext] ?? "application/octet-stream";
}
var assetExtensionOf = (contentType) => EXT_BY_MIME[(contentType.split(";")[0] ?? "").trim().toLowerCase()] ?? "bin";
function isProjectPath(p) {
  if (typeof p !== "string" || !p.startsWith("project/") || p.includes("\\") || p.includes("\0")) return false;
  return p.split("/").every((part) => part !== "" && part !== "." && part !== "..");
}
var isWriteEntry = (entry) => entry !== null && !("delete" in entry);
function isWireEntry(value) {
  if (value === null) return true;
  if (typeof value !== "object" || Array.isArray(value)) return false;
  const entry = value;
  if (entry.delete === true) return entry.ifMatch === void 0 || typeof entry.ifMatch === "string";
  if (entry.ifMatch !== void 0 && entry.ifMatch !== null && typeof entry.ifMatch !== "string") return false;
  return typeof entry.base64 === "string" && typeof entry.contentType === "string";
}
function pageCsp(scriptSrc) {
  const fonts = "https://fonts.googleapis.com https://fonts.gstatic.com";
  return [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob:",
    "media-src 'self' blob:",
    "worker-src 'self' blob:",
    `connect-src 'self' data: blob: ${fonts}`,
    "frame-src 'self' blob: data:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'none'"
  ].join("; ");
}
function versionOf(files) {
  const digest = sha256(
    Object.entries(files).map(([p, f]) => `${p}:${f.sha256}`).join("\n")
  );
  return "local-" + digest.slice(0, 16);
}
var isIgnoredPath = (rel) => rel.split("/").some((part) => part.startsWith("."));
async function collectFiles(root, limit) {
  const rels = [];
  const seen = /* @__PURE__ */ new Set();
  let truncated = false;
  const visit = async (relDir, descend) => {
    const dir = relDir === "" ? root : path5.join(root, ...relDir.split("/"));
    let entries;
    try {
      entries = await fsp2.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    entries.sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
    for (const entry of entries) {
      if (truncated) return;
      if (entry.name.startsWith(".")) continue;
      const rel = relDir === "" ? entry.name : `${relDir}/${entry.name}`;
      if (entry.isDirectory()) {
        if (descend && LAYOUT.descendInto(rel)) await visit(rel, true);
      } else if (entry.isFile() && LAYOUT.isFile(rel) && !seen.has(rel)) {
        if (rels.length >= limit) {
          truncated = true;
          return;
        }
        seen.add(rel);
        rels.push(rel);
      }
    }
  };
  for (const start of LAYOUT.roots) {
    if (truncated) break;
    await visit(start.rel, start.descend);
  }
  return { rels, truncated };
}
async function writeFileAtomic(file, bytes) {
  await fsp2.mkdir(path5.dirname(file), { recursive: true });
  const tmp = path5.join(path5.dirname(file), `.${path5.basename(file)}.${randomUUID()}.tmp`);
  try {
    await fsp2.writeFile(tmp, bytes);
    await fsp2.rename(tmp, file);
  } catch (error) {
    await fsp2.rm(tmp, { force: true }).catch(() => {
    });
    throw error;
  }
}
var Store = class {
  root;
  log;
  /** project/<path> → sha256 of the page's last save not yet seen by the watcher ('' for a delete). */
  ownWrites;
  queue;
  seq;
  truncationReported;
  constructor(root, log) {
    this.root = root;
    this.log = log;
    this.ownWrites = /* @__PURE__ */ new Map();
    this.queue = Promise.resolve();
    this.seq = 0;
    this.truncationReported = false;
  }
  /** Run `work` after every save, upload and change check before it, and before the next. */
  exclusive(work) {
    const run = this.queue.then(work);
    this.queue = run.catch(() => void 0);
    return run;
  }
  /** project/<path> → its path relative to project/, or null when the editor may not see or write it. */
  fileOf(runtimePath) {
    if (!isProjectPath(runtimePath)) return null;
    const rel = runtimePath.slice("project/".length);
    return LAYOUT.isFile(rel) ? rel : null;
  }
  /** The file on disk (it may not exist yet); null when a directory on the way is a symlink or the name is not a file. */
  async diskPath(rel) {
    const realRoot = await fsp2.realpath(this.root).catch(() => null);
    if (realRoot === null) return null;
    const file = path5.join(realRoot, ...rel.split("/"));
    for (let dir = path5.dirname(file); ; dir = path5.dirname(dir)) {
      const real = await fsp2.realpath(dir).catch(() => null);
      if (real === null) {
        if (path5.dirname(dir) === dir) return null;
        continue;
      }
      if (real !== dir) return null;
      break;
    }
    const info = await fsp2.lstat(file).catch(() => null);
    return info && !info.isFile() ? null : file;
  }
  async listing() {
    const limit = LAYOUT.maxFiles;
    const { rels, truncated } = await collectFiles(this.root, limit);
    if (truncated && !this.truncationReported) {
      this.truncationReported = true;
      this.log(`The ${NOUN} folder has more than ${limit} files; the editor lists only the first ${limit}: ${this.root}`);
    }
    const files = {};
    for (const rel of rels.sort()) {
      const file = await this.diskPath(rel);
      if (file === null) continue;
      const bytes = await fsp2.readFile(file).catch(() => null);
      if (bytes === null) continue;
      files[`project/${rel}`] = { sha256: sha256(bytes), size: bytes.length, contentType: contentTypeOf(rel) };
    }
    return { ver: versionOf(files), files };
  }
  async readProjectFile(p) {
    const rel = this.fileOf(p);
    const file = rel === null ? null : await this.diskPath(rel);
    if (file === null) return null;
    return fsp2.readFile(file).catch(() => null);
  }
  /** A save from the page: all entries or none (ifMatch is checked for all before anything is written). */
  publish(batch) {
    return this.exclusive(() => this.publishNow(batch));
  }
  async publishNow(batch) {
    const files = /* @__PURE__ */ new Map();
    let total = 0;
    for (const [p, entry] of Object.entries(batch)) {
      const rel = this.fileOf(p);
      const file = rel === null ? null : await this.diskPath(rel);
      if (file === null) return { status: 400, body: { code: "read_only_path", message: LAYOUT.readOnlyMessage(p) } };
      files.set(p, file);
      if (!isWriteEntry(entry)) continue;
      const bytes = Buffer.byteLength(entry.base64, "base64");
      if (bytes > LAYOUT.maxFileBytes) {
        return { status: 413, body: { code: "too_large", message: `${p}: a file can be at most ${LAYOUT.maxFileBytes} bytes` } };
      }
      total += bytes;
    }
    if (total > LAYOUT.maxPublishBytes) {
      return { status: 413, body: { code: "too_large", message: `a publish can write at most ${LAYOUT.maxPublishBytes} bytes` } };
    }
    const before = await this.listing();
    const conflicts = [];
    for (const [p, entry] of Object.entries(batch)) {
      const expected = entry?.ifMatch;
      if (expected === void 0) continue;
      const actual = before.files[p]?.sha256 ?? null;
      if (actual !== expected) conflicts.push({ path: p, actual, expected });
    }
    if (conflicts.length > 0) return { status: 409, body: { code: "conflict", live: before.ver, paths: conflicts } };
    const shas = {};
    for (const [p, entry] of Object.entries(batch)) {
      const file = files.get(p);
      if (!isWriteEntry(entry)) {
        this.ownWrites.set(p, "");
        await fsp2.rm(file, { force: true });
        continue;
      }
      const bytes = Buffer.from(entry.base64, "base64");
      const sha = sha256(bytes);
      this.ownWrites.set(p, sha);
      await writeFileAtomic(file, bytes);
      shas[p] = sha;
    }
    const after = await this.listing();
    this.seq += 1;
    return { status: 200, body: { version: after.ver, seq: this.seq, shas } };
  }
  async assetIndex() {
    try {
      const file = await this.diskPath(`${LAYOUT.blobDir}/${ASSET_INDEX}`);
      if (file === null) return {};
      const parsed = JSON.parse(await fsp2.readFile(file, "utf8"));
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  /** An upload, addressed by content: id = the first 32 hex digits of its sha256, stored once. */
  putBlob(bytes, contentType) {
    return this.exclusive(() => this.putBlobNow(bytes, contentType));
  }
  async putBlobNow(bytes, contentType) {
    const id = sha256(bytes).slice(0, 32);
    const type = (contentType.split(";")[0] ?? "").trim().toLowerCase() || "application/octet-stream";
    if (await this.findBlobFile(id) === null) {
      const file = await this.diskPath(`${LAYOUT.blobDir}/${id}.${assetExtensionOf(type)}`);
      if (file === null) throw new Error(`${LAYOUT.blobDir} directory is not writable`);
      await writeFileAtomic(file, bytes);
    }
    const index = await this.assetIndex();
    const indexFile = await this.diskPath(`${LAYOUT.blobDir}/${ASSET_INDEX}`);
    if (index[id] !== type && indexFile !== null) {
      index[id] = type;
      await writeFileAtomic(indexFile, Buffer.from(JSON.stringify(index, null, 2) + "\n"));
    }
    return { id, url: `/_blob/${id}`, sizeBytes: bytes.byteLength };
  }
  async findBlobFile(id) {
    try {
      const names = await fsp2.readdir(path5.join(this.root, LAYOUT.blobDir));
      const name = names.find((n) => n.startsWith(`${id}.`) && !n.endsWith(".tmp"));
      if (name === void 0) return null;
      const file = await this.diskPath(`${LAYOUT.blobDir}/${name}`);
      return file !== null && (await fsp2.lstat(file).catch(() => null))?.isFile() ? file : null;
    } catch {
      return null;
    }
  }
  async blobFile(id) {
    if (!BLOB_ID.test(id)) return null;
    const file = await this.findBlobFile(id);
    if (file === null) return null;
    return { file, contentType: (await this.assetIndex())[id] ?? contentTypeOf(file) };
  }
  /**
   * Of these paths, the ones whose content on disk is neither the page's own last save nor what was already seen.
   * Runs inside `exclusive`, so no save is half done; afterwards `seen` holds what is on disk and the saves are settled.
   */
  async externalChanges(paths, seen) {
    const external = [];
    for (const p of paths) {
      const rel = this.fileOf(p);
      if (rel === null) continue;
      let sha = "";
      try {
        const file = await this.diskPath(rel);
        if (file !== null && (await fsp2.lstat(file)).isFile()) sha = sha256(await fsp2.readFile(file));
      } catch {
        sha = "";
      }
      if (this.ownWrites.get(p) !== sha && seen.get(p) !== sha) external.push(p);
      this.ownWrites.delete(p);
      seen.set(p, sha);
    }
    return external;
  }
};
function watchArtifact(store, onChange, onError) {
  let timer;
  let stopped = false;
  const watchers = /* @__PURE__ */ new Map();
  let seen = null;
  let pollSignature = null;
  let polling = false;
  const maxDirectories = LAYOUT.maxFiles;
  const schedule = () => {
    if (stopped) return;
    clearTimeout(timer);
    timer = setTimeout(() => void store.exclusive(flush), WATCH_DEBOUNCE_MS2);
  };
  const refresh = () => {
    const directories = /* @__PURE__ */ new Map();
    const visit = (rel, descend) => {
      if (directories.size >= maxDirectories) return;
      const dir = rel === "" ? store.root : path5.join(store.root, ...rel.split("/"));
      if (directories.has(dir) || !fs6.existsSync(dir)) return;
      const info = fs6.lstatSync(dir);
      if (!info.isDirectory()) return;
      directories.set(dir, `${info.dev}:${info.ino}`);
      if (!descend) return;
      for (const entry of fs6.readdirSync(dir, { withFileTypes: true })) {
        if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
        const child = rel === "" ? entry.name : `${rel}/${entry.name}`;
        if (LAYOUT.descendInto(child)) visit(child, true);
      }
    };
    for (const start of LAYOUT.roots) visit(start.rel, start.descend);
    for (const [dir, item] of watchers) {
      if (directories.get(dir) !== item.identity) {
        item.watcher.close();
        watchers.delete(dir);
      }
    }
    for (const [dir, identity] of directories) {
      if (watchers.has(dir)) continue;
      let watcher;
      try {
        watcher = fs6.watch(dir, (event, name) => {
          if (stopped) return;
          if (name) {
            const changed = path5.join(dir, String(name));
            if (event === "rename" && watchers.has(changed)) {
              for (const [watchedDir, item] of watchers) {
                if (watchedDir === changed || watchedDir.startsWith(changed + path5.sep)) {
                  item.watcher.close();
                  watchers.delete(watchedDir);
                }
              }
            }
            const rel = path5.relative(store.root, changed).split(path5.sep).join("/");
            if (isIgnoredPath(rel) || !LAYOUT.watches(rel)) return;
          }
          schedule();
        });
      } catch (error) {
        onError(error);
        continue;
      }
      watcher.on("error", onError);
      watchers.set(dir, { watcher, identity });
    }
  };
  const flush = async () => {
    if (stopped) return;
    try {
      refresh();
      const current = await store.listing();
      if (seen === null) {
        seen = new Map(Object.entries(current.files).map(([p, f]) => [p, f.sha256]));
        pollSignature = await signature();
        return;
      }
      const external = await store.externalChanges(/* @__PURE__ */ new Set([...seen.keys(), ...Object.keys(current.files)]), seen);
      if (stopped || external.length === 0) return;
      onChange({ type: "external-change", paths: external, ver: (await store.listing()).ver });
    } catch (error) {
      onError(error);
    }
  };
  const signature = async () => {
    const { rels } = await collectFiles(store.root, LAYOUT.maxFiles);
    const parts = [];
    for (const rel of rels) {
      const info = await fsp2.lstat(path5.join(store.root, ...rel.split("/"))).catch(() => null);
      parts.push(info ? `${rel}\0${info.size}\0${info.mtimeMs}\0${info.ino}` : `${rel}\0-`);
    }
    return parts.join("\n");
  };
  const poll = setInterval(async () => {
    if (stopped || polling) return;
    polling = true;
    try {
      const next = await signature();
      if (pollSignature !== null && next !== pollSignature) schedule();
      pollSignature = next;
    } catch (error) {
      onError(error);
    } finally {
      polling = false;
    }
  }, POLL_MS2);
  poll.unref?.();
  void store.exclusive(flush);
  return () => {
    stopped = true;
    clearTimeout(timer);
    clearInterval(poll);
    for (const item of watchers.values()) item.watcher.close();
    watchers.clear();
  };
}
var publishError = (response, status, code, message) => sendJson2(response, status, { code, message });
async function startServer({ root, port = DEFAULT_PORTS[KIND], host = "127.0.0.1", log = (line) => process.stderr.write(`${line}
`), agentHook, lan = false, portGiven = false }) {
  const project = path5.join(root, "project");
  const stamp = (line) => log(`[${(/* @__PURE__ */ new Date()).toISOString()}] ${line}`);
  const projectDir = await fsp2.realpath(project);
  const store = new Store(projectDir, stamp);
  const owner = localOwner();
  const share = new ShareHost({
    root,
    cookieName: guestCookieName(KIND, root),
    owner,
    noun: NOUNS[KIND] ?? { en: NOUN, zh: NOUN, zhThis: NOUN },
    title: () => artifactTitle(root, projectDir),
    log: stamp,
    createServer: () => http.createServer(handle),
    uiFile: path5.join(EDITOR_DIR, "share-ui.js")
  });
  const comments = createCommentsService({
    root,
    log: stamp,
    locate: commentLocation ? (input) => commentLocation(input, projectDir) : void 0,
    agentHook,
    userName: owner.name,
    allowWrite: sameOrigin,
    viewer: (request) => {
      const viewer = share.viewerOf(request);
      return viewer ? commentsViewer(viewer) : null;
    }
  });
  const grant = randomBytes(24).toString("base64url");
  const editorPath = `/${KIND}/${grant}/`;
  const boot = randomBytes(6).toString("hex");
  const clients = /* @__PURE__ */ new Map();
  const changes = [];
  let changeSeq = 0;
  const pageCache = /* @__PURE__ */ new Map();
  const eventId = () => `${boot}.${changeSeq}`;
  const frame = (event) => `id: ${eventId()}
event: ${event.type}
data: ${JSON.stringify(event)}

`;
  const changed = (event, from) => {
    changeSeq += 1;
    changes.push({ seq: changeSeq, paths: event.paths, ...from ? { from } : {} });
    if (changes.length > CHANGE_LOG_SIZE) changes.shift();
    for (const [client, id] of clients) if (!from || id !== from) client.write(frame(event));
  };
  const stopWatch = watchArtifact(
    store,
    (event) => {
      stamp(`changed on disk: ${event.paths.join(", ")}${clients.size ? "" : " (no page open)"}`);
      changed(event);
    },
    (error) => stamp(`watching failed: ${errorText(error)}`)
  );
  const events = async (request, response, viewer) => {
    const given = new URL(request.url ?? "/", "http://local").searchParams.get("client") ?? "";
    const client = CLIENT_ID.test(given) ? given : "";
    response.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no"
    });
    response.write(": connected\n\n");
    const last = /^([0-9a-f]+)\.(\d+)$/.exec(String(request.headers["last-event-id"] ?? ""));
    const missedSince = last && last[1] === boot ? Number(last[2]) : null;
    const truncated = missedSince !== null && changes.length > 0 && changes[0].seq > missedSince + 1;
    const missed = missedSince === null ? [] : truncated ? changes : changes.filter((c) => c.seq > missedSince && (!client || c.from !== client));
    if (missed.length) {
      const paths = [...new Set(missed.flatMap((c) => c.paths))];
      response.write(frame({ type: "external-change", paths, ver: (await store.listing()).ver }));
    } else {
      response.write(`id: ${eventId()}

`);
    }
    clients.set(response, client);
    share.hold(viewer, response);
    const keepAlive = setInterval(() => response.write(": ping\n\n"), SSE_KEEPALIVE_MS2);
    keepAlive.unref?.();
    const done = () => {
      clearInterval(keepAlive);
      clients.delete(response);
    };
    request.on("close", done);
    response.on("close", done);
  };
  const serveBlob = async (request, response, id) => {
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405, { Allow: "GET, HEAD" }).end();
      return;
    }
    const found = await store.blobFile(id);
    const info = found === null ? null : await fsp2.stat(found.file).catch(() => null);
    if (found === null || !info?.isFile()) {
      response.writeHead(404, { "Cache-Control": "no-store" }).end();
      return;
    }
    sendFile(request, response, found.file, {
      "Content-Type": found.contentType,
      "Content-Length": info.size,
      // Addressed by content: an id's bytes never change.
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": DATA_CSP
    });
  };
  const serveEditor = async (request, response, rest, viewer) => {
    const parts = rest === "" ? ["index.html"] : rest.split("/");
    const invalid = parts.some((p) => p === "" || p === "." || p === ".." || p.startsWith(".") || p.includes("\\")) || parts[0] === "node";
    const realDist = invalid ? null : await fsp2.realpath(EDITOR_DIR).catch(() => null);
    const file = realDist === null ? null : path5.join(realDist, ...parts);
    const real = file === null ? null : await fsp2.realpath(file).catch(() => null);
    const info = real === null ? null : await fsp2.lstat(real).catch(() => null);
    if (file === null || real !== file || !info?.isFile()) {
      if (realDist === null && !invalid && parts[0] === "index.html") {
        response.writeHead(503, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" }).end("The editor page is missing; reinstall the skill.");
        return;
      }
      response.writeHead(404, { "Cache-Control": "no-store" }).end();
      return;
    }
    const ext = path5.extname(file).toLowerCase();
    const type = STATIC_TYPES[ext] ?? "application/octet-stream";
    if (ext === ".html") {
      const key = parts.join("/");
      let page = pageCache.get(key);
      if (!page || page.mtimeMs !== info.mtimeMs) {
        const html = await fsp2.readFile(file, "utf8");
        page = { mtimeMs: info.mtimeMs, html, csp: pageCsp(pageScriptSrc(html)) };
        pageCache.set(key, page);
      }
      const body = Buffer.from(share.injectHead(page.html, viewer) ?? page.html);
      response.writeHead(200, {
        "Content-Type": type,
        "Content-Length": body.length,
        "Cache-Control": "no-cache",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
        "Content-Security-Policy": page.csp
      });
      response.end(request.method === "HEAD" ? void 0 : body);
      return;
    }
    sendFile(request, response, file, {
      "Content-Type": type,
      "Content-Length": info.size,
      // The page's build names its assets by content hash.
      "Cache-Control": parts[0] === "assets" ? "private, max-age=31536000, immutable" : "no-cache",
      "X-Content-Type-Options": "nosniff"
    });
  };
  const publish = async (request, response) => {
    if (!/^application\/json\b/i.test(request.headers["content-type"] ?? "")) {
      publishError(response, 415, "invalid_content", "expected application/json");
      return;
    }
    const raw = await readBody(request, MAX_PUBLISH_BYTES);
    let files;
    try {
      const body = JSON.parse(raw.toString("utf8"));
      if (typeof body?.files !== "object" || body.files === null || Array.isArray(body.files)) throw new Error("files");
      if (!Object.values(body.files).every(isWireEntry)) throw new Error("entry");
      files = body.files;
    } catch {
      publishError(response, 400, "invalid_content", "malformed publish request");
      return;
    }
    const outcome = await store.publish(files);
    const names = Object.keys(files).map((p) => p.replace(/^project\//, ""));
    stamp(`saved from the page (${outcome.status}${outcome.body.code ? ` ${outcome.body.code}` : ""}): ${names.join(", ")}`);
    sendJson2(response, outcome.status, outcome.body);
    if (outcome.status === 200 && clients.size > 0) {
      const from = String(request.headers["x-deck-client"] ?? "");
      changed({ type: "external-change", paths: Object.keys(files), ver: String(outcome.body.version ?? "") }, CLIENT_ID.test(from) ? from : void 0);
    }
  };
  const upload = async (request, response) => {
    const contentType = request.headers["content-type"] ?? "application/octet-stream";
    const limit = Math.min(MAX_ASSET_BYTES, LAYOUT.maxBlobBytes(contentType));
    const bytes = await readBody(request, limit);
    if (bytes.length === 0) {
      publishError(response, 400, "invalid_content", "empty upload");
      return;
    }
    const result = await store.putBlob(bytes, contentType);
    stamp(`uploaded from the page: ${result.url} (${contentType}, ${bytes.length} bytes)`);
    sendJson2(response, 200, result);
  };
  const session = (viewer) => {
    const extras = sessionExtras();
    if (viewer.guest && "userName" in extras) extras.userName = viewer.user.name;
    return { canEdit: canEditAs(viewer.role), ...extras, role: viewer.role };
  };
  const route = async (request, response, rest, viewer) => {
    const method = request.method ?? "GET";
    if (rest === COMMENTS_ROUTE || rest.startsWith(`${COMMENTS_ROUTE}/`)) {
      const sub = rest.slice(COMMENTS_ROUTE.length);
      if (sub === "/events") share.hold(viewer, response);
      return comments.handle(request, response, sub);
    }
    if (rest === ROUTES.publish || rest === ROUTES.assets) {
      if (method !== "POST") {
        response.writeHead(405, { Allow: "POST" }).end();
        return;
      }
      if (!sameOrigin(request)) {
        request.resume();
        publishError(response, 403, "not_writer", "cross-origin request");
        return;
      }
      if (!canEditAs(viewer.role)) {
        request.resume();
        publishError(response, 403, "not_writer", `You can view this ${NOUN} but not edit it.`);
        return;
      }
      if (rest === ROUTES.publish) await publish(request, response);
      else await upload(request, response);
      return;
    }
    if (method !== "GET" && method !== "HEAD") {
      response.writeHead(405, { Allow: "GET, HEAD" }).end();
      return;
    }
    if (rest === ROUTES.listing) return sendJson2(response, 200, await store.listing());
    if (rest === ROUTES.session) return sendJson2(response, 200, session(viewer));
    if (rest === ROUTES.events) return events(request, response, viewer);
    if (rest.startsWith("project/")) {
      const bytes = await store.readProjectFile(rest);
      if (bytes === null) {
        response.writeHead(404, { "Cache-Control": "no-store" }).end();
        return;
      }
      response.writeHead(200, {
        "Content-Type": contentTypeOf(rest),
        "Content-Length": bytes.byteLength,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": DATA_CSP
      });
      response.end(method === "HEAD" ? void 0 : bytes);
      return;
    }
    const blob = BLOB_PATH.exec(rest);
    if (blob) return serveBlob(request, response, blob[1]);
    return serveEditor(request, response, rest, viewer);
  };
  const guard = async (response, work) => {
    try {
      await work();
    } catch (error) {
      if (error instanceof TooLarge2) {
        if (!response.headersSent) publishError(response, 413, "too_large", "request body is too large");
        return;
      }
      stamp(`request failed: ${error instanceof Error ? error.stack ?? error.message : String(error)}`);
      if (!response.headersSent) publishError(response, 500, "upstream_error", "internal error");
      else response.destroy();
    }
  };
  async function handle(request, response) {
    if (!share.hostAllowed(request)) {
      request.resume();
      response.writeHead(421, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" }).end("Misdirected request");
      return;
    }
    const url2 = new URL(request.url ?? "/", "http://localhost");
    const pathname = url2.pathname;
    if (pathname === "/favicon.ico") {
      response.writeHead(204).end();
      return;
    }
    if (await share.route(request, response)) return;
    const viewer = share.viewerOf(request);
    if (!viewer) return share.denied(request, response);
    if (pathname === "/" || pathname === "/index.html") {
      response.writeHead(302, { Location: editorPath, "Cache-Control": "no-store" }).end();
      return;
    }
    const rootBlob = BLOB_PATH.exec(pathname.slice(1));
    if (rootBlob) {
      void guard(response, () => serveBlob(request, response, rootBlob[1]));
      return;
    }
    const match = /^\/([a-z-]+)\/([^/]+)(\/.*)?$/.exec(pathname);
    if (!match || match[1] !== KIND || match[2] !== grant) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" }).end("Not found");
      return;
    }
    if (match[3] === void 0) {
      response.writeHead(308, { Location: `${editorPath}${url2.search}`, "Cache-Control": "no-store" }).end();
      return;
    }
    let rest;
    try {
      rest = decodeURIComponent(match[3].slice(1));
    } catch {
      response.writeHead(400).end();
      return;
    }
    void guard(response, () => route(request, response, rest, viewer));
  }
  const server2 = http.createServer((request, response) => void guard(response, () => handle(request, response)));
  const close = () => {
    stopWatch();
    comments.close();
    share.close();
    for (const client of clients.keys()) client.end();
    clients.clear();
    server2.close();
    server2.closeAllConnections?.();
  };
  const actualPort = await share.listen(server2, { port, host, lan, portGiven }).catch((error) => {
    close();
    throw error;
  });
  const url = `${serverOrigin(host, actualPort)}${editorPath}`;
  stamp(`serving ${project} at ${url}`);
  const lanUrls = share.lanUrls();
  return { url, port: actualPort, grant, close, ...lanUrls.length ? { lan: lanUrls } : {} };
}
function artifactTitle(root, projectDir) {
  try {
    const index = JSON.parse(fs6.readFileSync(path5.join(projectDir, INDEX_FILE), "utf8"));
    for (const value of [index.title, index.name]) if (typeof value === "string" && value.trim() && value.trim() !== "project") return value.trim();
  } catch {
  }
  return path5.basename(root);
}
var runningServer2 = (root) => runningServer(root, KIND, ROUTES.session);
async function serveForeground({ root, port, host, agentHook, lan, portGiven }) {
  const running = await startServer({ root, port, host, agentHook, lan, portGiven });
  const state = { pid: process.pid, url: running.url, port: running.port, root, kind: KIND, startedAt: (/* @__PURE__ */ new Date()).toISOString() };
  recordServer(state, running.close);
  return { ...state, ...running.lan ? { lan: running.lan } : {} };
}
async function main(argv) {
  const positional = [];
  const flags = /* @__PURE__ */ new Map();
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) positional.push(arg);
    else if (arg.includes("=")) flags.set(arg.slice(2, arg.indexOf("=")), arg.slice(arg.indexOf("=") + 1));
    else if (arg === "--lan") flags.set("lan", "true");
    else flags.set(arg.slice(2), argv[++i] ?? "");
  }
  if (positional.length !== 1 || flags.has("help")) {
    process.stderr.write(
      `Usage: node ${path5.basename(SCRIPT)} <root> [--port n] [--host h] [--lan] [--agent-hook "<command>"]
<root> holds project/${INDEX_FILE}.
`
    );
    return 2;
  }
  let root = path5.resolve(positional[0]);
  if (path5.basename(root) === "project" && fs6.existsSync(path5.join(root, INDEX_FILE)) && !fs6.existsSync(path5.join(root, "project"))) {
    root = path5.dirname(root);
  }
  if (!fs6.statSync(path5.join(root, "project", INDEX_FILE), { throwIfNoEntry: false })?.isFile()) {
    process.stderr.write(`${JSON.stringify({ error: "NOT_FOUND", message: `${path5.join(root, "project", INDEX_FILE)} does not exist.` })}
`);
    return 2;
  }
  const port = flags.has("port") ? Number(flags.get("port")) : DEFAULT_PORTS[KIND];
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    process.stderr.write(`${JSON.stringify({ error: "INVALID_PORT", message: "--port is a number from 0 to 65535." })}
`);
    return 2;
  }
  const existing = await runningServer2(root);
  if (existing) {
    process.stdout.write(`${JSON.stringify({ url: existing.url, root, pid: existing.pid, reused: true }, null, 2)}
`);
    return 0;
  }
  const agentHook = flags.get("agent-hook") || void 0;
  const state = await serveForeground({ root, port, host: flags.get("host") ?? "127.0.0.1", agentHook, lan: flags.has("lan"), portGiven: flags.has("port") });
  process.stdout.write(`${JSON.stringify({ url: state.url, root, pid: state.pid, ...state.lan ? { lan: state.lan } : {} }, null, 2)}
`);
  return -1;
}
function isMain(moduleUrl) {
  try {
    return Boolean(process.argv[1]) && pathToFileURL(fs6.realpathSync(process.argv[1])).href === moduleUrl;
  } catch {
    return false;
  }
}
function createArtifactServer(kind, moduleUrl) {
  KIND = kind.kind;
  NOUN = kind.noun;
  INDEX_FILE = kind.indexFile;
  LAYOUT = kind.layout;
  pageScriptSrc = kind.pageScriptSrc;
  sessionExtras = kind.sessionExtras;
  commentLocation = kind.commentLocation;
  SCRIPT = fileURLToPath(moduleUrl);
  EDITOR_DIR = path5.join(path5.dirname(SCRIPT), "editor");
  const runIfMain = () => {
    if (!isMain(moduleUrl)) return;
    main(process.argv.slice(2)).then(
      (code) => {
        if (code >= 0) process.exitCode = code;
      },
      (error) => {
        const code = error.code === "PORT_IN_USE" ? "PORT_IN_USE" : "SERVER_FAILED";
        process.stderr.write(`${JSON.stringify({ error: code, message: errorText(error) })}
`);
        process.exitCode = 2;
      }
    );
  };
  return { startServer, runningServer: runningServer2, serveForeground, readState, runIfMain };
}

var KIND2 = "design-system";
var NOUN2 = "design system";
var INDEX_FILE2 = "design-system.json";
var BLOBS_DIR = "_blobs";
var MAX_PATH_LENGTH = 300;
var MAX_RUNTIME_PATH_UTF8_BYTES = 512;
var UNSAFE_PATH_CHARACTER = /[\u0000-\u001f\u007f-\u009f\u200b\u200e\u200f\u202a-\u202e\u2028\u2029\u2060-\u206f\u2215\u2044\ufeff\uff0f]/;
var RUNTIME_PATH_RESERVED_CHARACTERS = /[%;:\\]/;
var INVISIBLE_PATH_CHARACTERS = /[\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/g;
var RESERVED_PROTOTYPE_NAMES = /* @__PURE__ */ new Set(["__proto__", "constructor", "prototype"]);
var REFUSED_TOOL_DIRECTORIES = /* @__PURE__ */ new Set(["node_modules"]);
var REFUSED_TOOL_FILENAMES = /* @__PURE__ */ new Set([
  "package.json",
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "bun.lock",
  "bun.lockb",
  "bunfig.toml",
  "tsconfig.json",
  "jsconfig.json",
  "deno.json",
  "deno.jsonc",
  "claude.md",
  "claude.local.md",
  "agents.md"
]);
var WINDOWS_SHORT_NAME = /~\d/;
var IMAGE_SLOT_STATE_FILENAME = ".image-slots.state.json";
function comparableSegment(segment) {
  let normalized = segment.replace(INVISIBLE_PATH_CHARACTERS, "");
  const colon = normalized.indexOf(":");
  if (colon >= 0) normalized = normalized.slice(0, colon);
  return normalized.normalize("NFC").toUpperCase().toLowerCase().replace(/[. ]+$/, "");
}
var comparablePath = (rel) => rel.split("/").map(comparableSegment).join("/");
function isImageSlotStatePath(rel) {
  const parts = rel.split("/");
  return parts[parts.length - 1] === IMAGE_SLOT_STATE_FILENAME && !parts.slice(0, -1).some((p) => comparableSegment(p).startsWith("."));
}
function explainToolConfigurationPath(rel) {
  const parts = rel.split("/").map(comparableSegment);
  if (parts.some((p) => p.startsWith(".")) && !isImageSlotStatePath(rel)) {
    return "is a dot-file or dot-directory (tool, editor, VCS or agent configuration); never part of a design system";
  }
  if (REFUSED_TOOL_FILENAMES.has(parts[parts.length - 1] ?? "") || parts.some((p) => REFUSED_TOOL_DIRECTORIES.has(p))) {
    return "is a package-manager, toolchain or agent-instruction file that tools auto-load from a working directory; never part of a design system";
  }
  if (parts.some((p) => WINDOWS_SHORT_NAME.test(p))) {
    return 'has a path segment shaped like a Windows 8.3 short name (NAME~1); rename it without the "~digit"';
  }
  return null;
}
function explainReservedSystemPath(rel) {
  const normalized = comparablePath(rel);
  const under = (name) => normalized === name || normalized.startsWith(`${name}/`);
  if (under(INDEX_FILE2)) return `is reserved: ${INDEX_FILE2} is the index; rename the file`;
  if (under("index.html")) return "is reserved: index.html is the page itself in the original format; rename the file";
  if (under("skill.md") || under("artifact-type")) {
    return "is reserved: SKILL.md and artifact-type/ are the design system type\u2019s own files in the original format; rename the file";
  }
  return null;
}
function explainDesignSystemPath(rel) {
  if (rel.length === 0 || rel.length > MAX_PATH_LENGTH || Buffer.byteLength(`project/${rel}`, "utf8") > MAX_RUNTIME_PATH_UTF8_BYTES) {
    return `is empty or longer than ${MAX_PATH_LENGTH} characters; rename it`;
  }
  if (rel.startsWith("/") || UNSAFE_PATH_CHARACTER.test(rel) || RUNTIME_PATH_RESERVED_CHARACTERS.test(rel)) {
    return "has a character a design system path cannot hold (a control or invisible character, a look-alike slash, % ; : or \\); rename it";
  }
  if (rel.endsWith(".cmekshadow")) return "ends in .cmekshadow, which is reserved; rename it";
  for (const part of rel.split("/")) {
    if (part === "" || part === "." || part === "..") return "has an empty path segment or one that is only dots; rename it";
    if (RESERVED_PROTOTYPE_NAMES.has(part)) return `uses "${part}" as a path segment, which is reserved; rename it`;
  }
  return explainToolConfigurationPath(rel) ?? explainReservedSystemPath(rel);
}
var isBlobsPath = (rel) => rel === BLOBS_DIR || rel.startsWith(`${BLOBS_DIR}/`);
function isArtifactFile(rel) {
  if (rel === INDEX_FILE2) return true;
  return !isBlobsPath(rel) && explainDesignSystemPath(rel) === null;
}
var descendInto = (rel) => !isBlobsPath(rel) && explainDesignSystemPath(rel) === null;
var LAYOUT2 = {
  blobDir: BLOBS_DIR,
  isFile: isArtifactFile,
  roots: [{ rel: "", descend: true }],
  descendInto,
  watches: (rel) => isArtifactFile(rel) || descendInto(rel),
  /** The format's limits: 1,024 files, 15 MiB a file, 16 MiB a save; an upload 20 MiB, an SVG 2 MiB. */
  maxFiles: 1024,
  maxPublishBytes: 16 * 1024 * 1024,
  maxFileBytes: 15 * 1024 * 1024,
  maxBlobBytes: (contentType) => ((contentType.split(";")[0] ?? "").trim().toLowerCase() === "image/svg+xml" ? 2 : 20) * 1024 * 1024,
  readOnlyMessage: (p) => {
    const rel = p.startsWith("project/") ? p.slice("project/".length) : p;
    if (isBlobsPath(rel)) return `${p}: ${BLOBS_DIR}/ holds uploads and can't be written; upload the file instead`;
    return `${p}: ${explainDesignSystemPath(rel) ?? "is not a design system file"}`;
  }
};
function sessionExtras2() {
  try {
    const name = os4.userInfo().username.trim();
    return name ? { userName: name } : {};
  } catch {
    return {};
  }
}
function commentLocation2(input) {
  const detail = input.detail ?? "";
  const cut = detail.lastIndexOf(" \xB7 ");
  const named = /\(([^()]+)\)$/.exec(cut >= 0 ? detail.slice(0, cut) : detail)?.[1];
  return { file: projectFile(named) ?? `project/${INDEX_FILE2}` };
}
var server = createArtifactServer(
  {
    kind: KIND2,
    noun: NOUN2,
    indexFile: INDEX_FILE2,
    layout: LAYOUT2,
    /** The editor page and artifact-type/run.html: previews run the bundle and preview.html scripts. */
    pageScriptSrc: () => "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:",
    sessionExtras: sessionExtras2,
    commentLocation: commentLocation2
  },
  import.meta.url
);
var { startServer: startServer2, serveForeground: serveForeground2, runningServer: runningServer3, readState: readState2 } = server;
server.runIfMain();
export {
  INDEX_FILE2 as INDEX_FILE,
  KIND2 as KIND,
  LAYOUT2 as LAYOUT,
  NOUN2 as NOUN,
  readState2 as readState,
  runningServer3 as runningServer,
  serveForeground2 as serveForeground,
  startServer2 as startServer
};
