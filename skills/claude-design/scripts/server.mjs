#!/usr/bin/env node
// claude-design: local editor server (prebuilt; do not edit).

import fs5 from "node:fs";
import path4 from "node:path";

import { createHash, randomBytes, randomUUID } from "node:crypto";
import fs4 from "node:fs";
import fsp2 from "node:fs/promises";
import http from "node:http";
import path3 from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { spawn } from "node:child_process";
import fs2 from "node:fs";
import os from "node:os";

var COMMENTS_FILE = "comments.json";
var COMMENTS_VERSION = 1;
var LIMITS = { text: 1e4, label: 1e3, detail: 4e3, anchor: 2048, section: 200, name: 100 };
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
function parseDoc(text) {
  const data = JSON.parse(text);
  if (!isRecord(data) || data.version !== COMMENTS_VERSION || !Array.isArray(data.threads)) {
    throw new CommentsError("COMMENTS_FILE_INVALID", `not a version ${COMMENTS_VERSION} comments file (expected {"version": 1, "threads": [...]})`, 500);
  }
  const threads = data.threads.filter(
    (t) => isRecord(t) && typeof t.id === "string" && typeof t.anchor === "string" && typeof t.label === "string" && (t.status === "open" || t.status === "resolved") && Array.isArray(t.messages) && t.messages.every((m) => isRecord(m) && typeof m.text === "string" && isRecord(m.author) && (m.author.kind === "user" || m.author.kind === "agent"))
  );
  for (const t of threads) if (!isRecord(t.location)) t.location = {};
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
function editMessage(thread, messageId, text, now) {
  const message = thread.messages.find((m) => m.id === messageId);
  if (!message) throw new CommentsError("MESSAGE_NOT_FOUND", `No message ${messageId} in ${thread.id}.`, 404);
  if (message.author.kind !== "user") throw new CommentsError("MESSAGE_NOT_EDITABLE", "Only your own messages can be edited.", 403);
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
  const user = { kind: "user", name: userName };
  const allowWrite = options.allowWrite ?? (() => true);
  const clients = /* @__PURE__ */ new Set();
  const waiters = [];
  const hookRunning = /* @__PURE__ */ new Set();
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
  async function snapshot() {
    lastDoc = await readComments(root);
    return { threads: lastDoc.threads, agent: presence(), me: { name: userName } };
  }
  const frame = (snap) => `event: comments
data: ${JSON.stringify(snap)}

`;
  function broadcast() {
    queue = queue.then(async () => {
      if (closed) return;
      let snap;
      try {
        snap = await snapshot();
      } catch (error) {
        log(`comments: reading ${COMMENTS_FILE} failed: ${error.message}`);
        return;
      }
      const text = frame(snap);
      lastPresence = JSON.stringify(snap.agent);
      if (text === lastSent) return;
      lastSent = text;
      for (const client of clients) client.write(text);
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
  async function deliver() {
    if (closed) return;
    const waiter = waiters[0];
    if (waiter) {
      const views = await updateComments(root, (doc) => {
        const pending = pendingForAgent(doc);
        const at = now();
        for (const t of pending) markDelivered(t, at, "wait");
        return agentViews(doc, pending);
      });
      if (views.length === 0) return;
      if (waiter.done) {
        await updateComments(root, (doc) => {
          for (const t of doc.threads) if (views.some((v) => v.id === t.id) && t.agent?.via === "wait") t.agent = { status: "pending", sentAt: t.agent.sentAt };
        });
        return;
      }
      finishWaiter(waiter, { threads: views });
      log(`comments: sent to the agent (wait): ${views.map((v) => v.id).join(", ")}`);
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
  async function create(request, response) {
    const input = readNewThread(await readJson(request));
    if (!input) throw new CommentsError("INVALID_COMMENT", "expected {anchor, label, text} with a non-empty text");
    let location = {};
    try {
      location = await options.locate?.(input) ?? {};
    } catch (error) {
      log(`comments: could not resolve where a comment points: ${error.message}`);
    }
    const created = await updateComments(root, (doc) => addThread(doc, input, location, user, now()));
    log(`comments: ${created.id} added on ${created.label}${location.file ? ` (${location.file})` : ""}${input.send ? ", sent to the agent" : ""}`);
    sendJson(response, 201, { thread: created });
    await afterChange(Boolean(input.send));
  }
  async function events(request, response) {
    response.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no"
    });
    response.write(": connected\n\n");
    response.write(frame(await snapshot()));
    clients.add(response);
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
      if (parts.length === 0) {
        if (reading) return sendJson(response, 200, await snapshot());
        if (method === "POST") return await create(request, response);
      } else if (parts.length === 1 && parts[0] === "events") {
        if (reading) return await events(request, response);
      } else if (parts.length === 2 && parts[0] === "agent" && parts[1] === "wait") {
        if (reading) return await wait(request, response, url);
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
          const t = await updateComments(root, (doc) => {
            const found = findThread(doc, id);
            addMessage(found, user, input.text, now());
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
          const t = await updateComments(root, (doc) => {
            const found = findThread(doc, id);
            editMessage(found, messageId, input.text, now());
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
    for (const client of clients) client.end();
    clients.clear();
  }
  return { handle, presence, deliver, close };
}

import fs3 from "node:fs";
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
var sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
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
    const dir = relDir === "" ? root : path3.join(root, ...relDir.split("/"));
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
  await fsp2.mkdir(path3.dirname(file), { recursive: true });
  const tmp = path3.join(path3.dirname(file), `.${path3.basename(file)}.${randomUUID()}.tmp`);
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
    const file = path3.join(realRoot, ...rel.split("/"));
    for (let dir = path3.dirname(file); ; dir = path3.dirname(dir)) {
      const real = await fsp2.realpath(dir).catch(() => null);
      if (real === null) {
        if (path3.dirname(dir) === dir) return null;
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
      const names = await fsp2.readdir(path3.join(this.root, LAYOUT.blobDir));
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
      const dir = rel === "" ? store.root : path3.join(store.root, ...rel.split("/"));
      if (directories.has(dir) || !fs4.existsSync(dir)) return;
      const info = fs4.lstatSync(dir);
      if (!info.isDirectory()) return;
      directories.set(dir, `${info.dev}:${info.ino}`);
      if (!descend) return;
      for (const entry of fs4.readdirSync(dir, { withFileTypes: true })) {
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
        watcher = fs4.watch(dir, (event, name) => {
          if (stopped) return;
          if (name) {
            const changed = path3.join(dir, String(name));
            if (event === "rename" && watchers.has(changed)) {
              for (const [watchedDir, item] of watchers) {
                if (watchedDir === changed || watchedDir.startsWith(changed + path3.sep)) {
                  item.watcher.close();
                  watchers.delete(watchedDir);
                }
              }
            }
            const rel = path3.relative(store.root, changed).split(path3.sep).join("/");
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
      const info = await fsp2.lstat(path3.join(store.root, ...rel.split("/"))).catch(() => null);
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
async function startServer({ root, port = 0, host = "127.0.0.1", log = (line) => process.stderr.write(`${line}
`), agentHook }) {
  const project = path3.join(root, "project");
  const stamp = (line) => log(`[${(/* @__PURE__ */ new Date()).toISOString()}] ${line}`);
  const projectDir = await fsp2.realpath(project);
  const store = new Store(projectDir, stamp);
  const comments = createCommentsService({
    root,
    log: stamp,
    locate: commentLocation ? (input) => commentLocation(input, projectDir) : void 0,
    agentHook,
    allowWrite: sameOrigin
  });
  const grant = randomBytes(24).toString("base64url");
  const editorPath = `/${KIND}/${grant}/`;
  const boot = randomBytes(6).toString("hex");
  const clients = /* @__PURE__ */ new Set();
  const changes = [];
  let changeSeq = 0;
  const pageCache = /* @__PURE__ */ new Map();
  const eventId = () => `${boot}.${changeSeq}`;
  const frame = (event) => `id: ${eventId()}
event: ${event.type}
data: ${JSON.stringify(event)}

`;
  const stopWatch = watchArtifact(
    store,
    (event) => {
      changeSeq += 1;
      changes.push({ seq: changeSeq, paths: event.paths });
      if (changes.length > CHANGE_LOG_SIZE) changes.shift();
      stamp(`changed on disk: ${event.paths.join(", ")}${clients.size ? "" : " (no page open)"}`);
      for (const client of clients) client.write(frame(event));
    },
    (error) => stamp(`watching failed: ${errorText(error)}`)
  );
  const events = async (request, response) => {
    response.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no"
    });
    response.write(": connected\n\n");
    const last = /^([0-9a-f]+)\.(\d+)$/.exec(String(request.headers["last-event-id"] ?? ""));
    const missedSince = last && last[1] === boot ? Number(last[2]) : null;
    if (missedSince !== null && missedSince < changeSeq) {
      const missed = changes.filter((c) => c.seq > missedSince);
      const paths = [...new Set((missed.length ? missed : changes).flatMap((c) => c.paths))];
      response.write(frame({ type: "external-change", paths, ver: (await store.listing()).ver }));
    } else {
      response.write(`id: ${eventId()}

`);
    }
    clients.add(response);
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
  const serveEditor = async (request, response, rest) => {
    const parts = rest === "" ? ["index.html"] : rest.split("/");
    const invalid = parts.some((p) => p === "" || p === "." || p === ".." || p.startsWith(".") || p.includes("\\")) || parts[0] === "node";
    const realDist = invalid ? null : await fsp2.realpath(EDITOR_DIR).catch(() => null);
    const file = realDist === null ? null : path3.join(realDist, ...parts);
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
    const ext = path3.extname(file).toLowerCase();
    const type = STATIC_TYPES[ext] ?? "application/octet-stream";
    if (ext === ".html") {
      const key = parts.join("/");
      let page = pageCache.get(key);
      if (!page || page.mtimeMs !== info.mtimeMs) {
        const html = await fsp2.readFile(file, "utf8");
        page = { mtimeMs: info.mtimeMs, body: Buffer.from(html), csp: pageCsp(pageScriptSrc(html)) };
        pageCache.set(key, page);
      }
      response.writeHead(200, {
        "Content-Type": type,
        "Content-Length": page.body.length,
        "Cache-Control": "no-cache",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
        "Content-Security-Policy": page.csp
      });
      response.end(request.method === "HEAD" ? void 0 : page.body);
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
  const route = async (request, response, rest) => {
    const method = request.method ?? "GET";
    if (rest === COMMENTS_ROUTE || rest.startsWith(`${COMMENTS_ROUTE}/`)) return comments.handle(request, response, rest.slice(COMMENTS_ROUTE.length));
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
      if (rest === ROUTES.publish) await publish(request, response);
      else await upload(request, response);
      return;
    }
    if (method !== "GET" && method !== "HEAD") {
      response.writeHead(405, { Allow: "GET, HEAD" }).end();
      return;
    }
    if (rest === ROUTES.listing) return sendJson2(response, 200, await store.listing());
    if (rest === ROUTES.session) return sendJson2(response, 200, { canEdit: true, ...sessionExtras() });
    if (rest === ROUTES.events) return events(request, response);
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
    return serveEditor(request, response, rest);
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
  const server2 = http.createServer((request, response) => {
    const url2 = new URL(request.url ?? "/", "http://localhost");
    const pathname = url2.pathname;
    if (pathname === "/" || pathname === "/index.html") {
      response.writeHead(302, { Location: editorPath, "Cache-Control": "no-store" }).end();
      return;
    }
    if (pathname === "/favicon.ico") {
      response.writeHead(204).end();
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
    void guard(response, () => route(request, response, rest));
  });
  const close = () => {
    stopWatch();
    comments.close();
    for (const client of clients) client.end();
    clients.clear();
    server2.close();
    server2.closeAllConnections?.();
  };
  const actualPort = await listen(server2, port, host).catch((error) => {
    close();
    throw error;
  });
  const url = `${serverOrigin(host, actualPort)}${editorPath}`;
  stamp(`serving ${project} at ${url}`);
  return { url, port: actualPort, grant, close };
}
var runningServer2 = (root) => runningServer(root, KIND, ROUTES.session);
async function serveForeground({ root, port, host, agentHook }) {
  const running = await startServer({ root, port, host, agentHook });
  const state = { pid: process.pid, url: running.url, port: running.port, root, kind: KIND, startedAt: (/* @__PURE__ */ new Date()).toISOString() };
  recordServer(state, running.close);
  return state;
}
async function main(argv) {
  const positional = [];
  const flags = /* @__PURE__ */ new Map();
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) positional.push(arg);
    else if (arg.includes("=")) flags.set(arg.slice(2, arg.indexOf("=")), arg.slice(arg.indexOf("=") + 1));
    else flags.set(arg.slice(2), argv[++i] ?? "");
  }
  if (positional.length !== 1 || flags.has("help")) {
    process.stderr.write(
      `Usage: node ${path3.basename(SCRIPT)} <root> [--port n] [--host h] [--agent-hook "<command>"]
<root> holds project/${INDEX_FILE}.
`
    );
    return 2;
  }
  let root = path3.resolve(positional[0]);
  if (path3.basename(root) === "project" && fs4.existsSync(path3.join(root, INDEX_FILE)) && !fs4.existsSync(path3.join(root, "project"))) {
    root = path3.dirname(root);
  }
  if (!fs4.statSync(path3.join(root, "project", INDEX_FILE), { throwIfNoEntry: false })?.isFile()) {
    process.stderr.write(`${JSON.stringify({ error: "NOT_FOUND", message: `${path3.join(root, "project", INDEX_FILE)} does not exist.` })}
`);
    return 2;
  }
  const port = Number(flags.get("port") ?? 0);
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
  const state = await serveForeground({ root, port, host: flags.get("host") ?? "127.0.0.1", agentHook });
  process.stdout.write(`${JSON.stringify({ url: state.url, root, pid: state.pid }, null, 2)}
`);
  return -1;
}
function isMain(moduleUrl) {
  try {
    return Boolean(process.argv[1]) && pathToFileURL(fs4.realpathSync(process.argv[1])).href === moduleUrl;
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
  EDITOR_DIR = path3.join(path3.dirname(SCRIPT), "editor");
  const runIfMain = () => {
    if (!isMain(moduleUrl)) return;
    main(process.argv.slice(2)).then(
      (code) => {
        if (code >= 0) process.exitCode = code;
      },
      (error) => {
        process.stderr.write(`${JSON.stringify({ error: "SERVER_FAILED", message: errorText(error) })}
`);
        process.exitCode = 2;
      }
    );
  };
  return { startServer, runningServer: runningServer2, serveForeground, readState, runIfMain };
}

var KIND2 = "design";
var NOUN2 = "design";
var INDEX_FILE2 = "canvas.json";
var SEGMENT = /^[A-Za-z0-9_][A-Za-z0-9_.-]*$/;
function isArtifactFile(rel) {
  const parts = rel.split("/");
  if (parts[0] === "assets") return false;
  return parts.every((part) => SEGMENT.test(part));
}
var LAYOUT2 = {
  blobDir: "assets",
  isFile: isArtifactFile,
  roots: [{ rel: "", descend: true }],
  descendInto: isArtifactFile,
  watches: isArtifactFile,
  /** The format's limits: at most 512 files; one save writes at most 16 MB. */
  maxFiles: 512,
  maxPublishBytes: 16 * 1024 * 1024,
  maxFileBytes: Infinity,
  maxBlobBytes: () => Infinity,
  readOnlyMessage: (p) => `${p}: files under assets/, hidden paths and path segments outside [A-Za-z0-9_][A-Za-z0-9_.-]* can't be written`
};
function commentLocation2(input, projectDir) {
  const named = [...(input.detail ?? "").matchAll(/([^\s:;()]+\.dc\.html)\b/g)].flatMap((m) => {
    try {
      return [decodeURIComponent(m[1])];
    } catch {
      return [];
    }
  });
  let boards = [];
  try {
    const listed = JSON.parse(fs5.readFileSync(path4.join(projectDir, INDEX_FILE2), "utf8")).boards;
    if (listed && typeof listed === "object") boards = Object.keys(listed);
  } catch {
  }
  const board = named.find((name) => boards.includes(name)) ?? named[0];
  const file = projectFile(board);
  return board && file ? { file, board } : { file: "project/canvas.json" };
}
var server = createArtifactServer(
  {
    kind: KIND2,
    noun: NOUN2,
    indexFile: INDEX_FILE2,
    layout: LAYOUT2,
    /** Boards run inline scripts, compile JSX with Babel (eval) and load from blob:. */
    pageScriptSrc: () => "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:",
    sessionExtras: () => ({}),
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
