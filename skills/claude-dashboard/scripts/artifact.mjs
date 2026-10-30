#!/usr/bin/env node
// claude-dashboard: local Artifact tool (prebuilt; do not edit).

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
var SCRIPT = fileURLToPath(import.meta.url);
var SKILL_DIR = path.dirname(path.dirname(SCRIPT));
var EDITOR_DIR = path.join(path.dirname(SCRIPT), "editor");
var STATE_FILE = ".artifact-server.json";
var LOG_FILE = ".artifact-server.log";
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
var extOf = (name) => path.extname(name).slice(1).toLowerCase();
var contentTypeOf = (name) => CONTENT_TYPES[extOf(name)] ?? "application/octet-stream";
var quote = (s) => /^[A-Za-z0-9_./:@%+=-]+$/.test(s) ? s : `'${s.replace(/'/g, `'\\''`)}'`;
var cmd = (name, ...args) => ["node", quote(SCRIPT), name, ...args.map(quote)].join(" ");
function print(value, compact = false) {
  process.stdout.write(`${compact ? JSON.stringify(value) : JSON.stringify(value, null, 2)}
`);
}
function parseArgs(argv) {
  const positional = [];
  const flags = /* @__PURE__ */ new Map();
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const eq = arg.indexOf("=");
      if (eq > 0) flags.set(arg.slice(2, eq), arg.slice(eq + 1));
      else if (i + 1 < argv.length && !argv[i + 1].startsWith("--") && !["text", "json"].includes(arg.slice(2))) flags.set(arg.slice(2), argv[++i]);
      else flags.set(arg.slice(2), "true");
    } else positional.push(arg);
  }
  return { positional, flags };
}
function writeFileAtomic(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = path.join(path.dirname(file), `.tmp-${process.pid}-${Date.now()}-${path.basename(file)}`);
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, file);
}
function resolveRoot(given, { create = false } = {}) {
  if (!given) throw new CliError("MISSING_ROOT", "Give the dashboard folder (for example designs/<slug>).");
  const root = path.resolve(given);
  const stat = fs.statSync(root, { throwIfNoEntry: false });
  if (stat && !stat.isDirectory()) throw new CliError("NOT_A_FOLDER", `${given} is a file; the dashboard is a folder.`);
  if (!stat) {
    if (!create) throw new CliError("NOT_FOUND", `${root} does not exist. Write the dashboard first: ${cmd("write-db", given, "batch.json")}.`);
    fs.mkdirSync(root, { recursive: true });
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
var docFile = (root, segs) => path.join(root, "db", ...segs.slice(0, -1), `${segs.at(-1)}.json`);
function listDocFiles(root) {
  const out = /* @__PURE__ */ new Map();
  const base = path.join(root, "db");
  const walk = (dir, rel) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.name.startsWith(".")) continue;
      const full = path.join(dir, e.name);
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
    text = fs.readFileSync(file, "utf8");
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
      const data = JSON.parse(fs.readFileSync(file, "utf8"));
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
    const file = path.resolve(String(value.$file));
    try {
      return fs.readFileSync(file, "utf8");
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
          data = JSON.parse(fs.readFileSync(path.resolve(String(w.file_path)), "utf8"));
        } catch (error) {
          throw new CliError("INVALID_WRITE", `${where}.file_path ${JSON.stringify(w.file_path)}: ${error.code === "ENOENT" ? "no such file" : `not JSON (${error.message})`}.`);
        }
      } else data = w.data;
      if (!isObject(data)) throw new CliError("INVALID_WRITE", `${where}.data must be a JSON object (the document's fields).`);
      data = agent ? resolveFileRefs(data, `${where}.data`) : data;
      if (op === "set" && hasDeleteMarker(data)) throw new CliError("INVALID_WRITE", `${where}: {"__delete__": true} works only in an update; set writes the whole document.`);
    }
    const file = docFile(root, segs);
    const existing = fs.existsSync(file) ? readDoc(root, p) : { exists: false };
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
    if (w.op === "delete") fs.rmSync(w.file, { force: true });
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
var blobFile = (root, id) => path.join(root, "_blobs", id);
function readBlobMeta(root, id) {
  try {
    return JSON.parse(fs.readFileSync(`${blobFile(root, id)}.json`, "utf8"));
  } catch {
    return null;
  }
}
function putBlob(root, bytes, name, contentType) {
  const id = createHash("sha256").update(bytes).digest("hex").slice(0, 32);
  const file = blobFile(root, id);
  if (!fs.existsSync(file)) writeFileAtomic(file, bytes);
  const meta = { name, contentType, bytes: bytes.length, uploadedAt: (/* @__PURE__ */ new Date()).toISOString() };
  writeFileAtomic(`${file}.json`, `${JSON.stringify(meta, null, 2)}
`);
  return { url: `/_blob/${id}`, id, name, bytes: bytes.length, contentType };
}
function upload(root, given, flags) {
  if (!given) throw new CliError("MISSING_FILE", "Give the file to attach (CSV, TSV or JSON).");
  const file = path.resolve(given);
  const stat = fs.statSync(file, { throwIfNoEntry: false });
  if (!stat) throw new CliError("FILE_NOT_FOUND", `No such file: ${given}`);
  if (!stat.isFile()) throw new CliError("NOT_A_FILE", `${given} is not a regular file.`);
  if (stat.size > MAX_DATA_BYTES) {
    throw new CliError("FILE_TOO_LARGE", `${given} is ${kb(stat.size)}; a file dataset over 8 MB is refused. Keep only the columns and rows the dashboard shows, or aggregate first.`);
  }
  const name = flags.get("name") ?? path.basename(file);
  const type = flags.get("type") ?? contentTypeOf(name);
  const result = putBlob(root, fs.readFileSync(file), name, type);
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
  if (!fs.existsSync(blobFile(root, id))) throw new CliError("NOT_FOUND", `No attached file ${id} in ${root}/_blobs.`);
  const users = referencesTo(root, id);
  if (users.length > 0) throw new CliError("IN_USE", `${id} is still named by ${users.join(", ")}; change or delete those first.`);
  fs.rmSync(blobFile(root, id), { force: true });
  fs.rmSync(`${blobFile(root, id)}.json`, { force: true });
  return { deleted: `/_blob/${id}` };
}
function readDb(root, given, flags) {
  if (!given) {
    const files = listDocFiles(root);
    return {
      root,
      documents: [...files.keys()].sort().map((p) => ({ path: p, bytes: fs.statSync(files.get(p).file).size }))
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
    for (const name of fs.readdirSync(path.join(EDITOR_DIR, "assets"))) {
      if (!name.endsWith(".css")) continue;
      const css = fs.readFileSync(path.join(EDITOR_DIR, "assets", name), "utf8");
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
    const stat = fs.statSync(file, { throwIfNoEntry: false });
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
    const text = fs.readFileSync(file, "utf8");
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
    const writtenAt = fs.statSync(runsFile).mtime;
    const pageChanged = [...docs.keys()].some((p) => /^(files|datasets)\//.test(p) && fs.statSync(docFile(root, p.split("/"))).mtime > writtenAt);
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
    const writtenAt = fs.statSync(docFile(root, ["data", "users", LOCAL_USER_ID, "check"])).mtime;
    const changedSince = (re) => [...docs.keys()].some((p) => re.test(p) && fs.statSync(docFile(root, p.split("/"))).mtime > writtenAt);
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
async function runningServer(root) {
  const state = readState(root);
  if (!state || state.kind !== "dashboard" || !alive(state.pid)) return null;
  try {
    const res = await fetch(new URL("/_api/session", state.url), { signal: AbortSignal.timeout(2e3) });
    return res.ok ? state : null;
  } catch {
    return null;
  }
}
function localUserName() {
  try {
    return os.userInfo().username || "You";
  } catch {
    return "You";
  }
}
function serverFlags(flags) {
  const out = [];
  if (flags.has("port")) out.push("--port", flags.get("port"));
  if (flags.has("host")) out.push("--host", flags.get("host"));
  return out;
}
async function serve(root, flags) {
  if (!fs.existsSync(path.join(EDITOR_DIR, "index.html")) || !fs.existsSync(path.join(EDITOR_DIR, "local-host.js"))) {
    throw new CliError("EDITOR_MISSING", `The editor page is missing (${EDITOR_DIR}); reinstall the skill.`);
  }
  const existing = await runningServer(root);
  if (existing && existing.pid !== process.pid) {
    print({ url: existing.url, root, pid: existing.pid, reused: true }, true);
    return false;
  }
  const host = flags.get("host") ?? "127.0.0.1";
  const port = Number(flags.get("port") ?? 0);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new CliError("INVALID_PORT", "--port is a number from 0 to 65535.");
  const log = (line) => process.stderr.write(`[${(/* @__PURE__ */ new Date()).toISOString()}] ${line}
`);
  const dbDir = path.join(root, "db");
  fs.mkdirSync(dbDir, { recursive: true });
  const known = /* @__PURE__ */ new Map();
  const clients = /* @__PURE__ */ new Set();
  const send = (res, event, data) => res.write(`event: ${event}
data: ${JSON.stringify(data)}

`);
  const snapshot = () => Object.fromEntries([...known].map(([p, k]) => [p, JSON.parse(k.text)]));
  function rescan() {
    const files = listDocFiles(root);
    const changes = [];
    for (const [p, { file }] of files) {
      let stat;
      try {
        stat = fs.statSync(file);
      } catch {
        continue;
      }
      const prev = known.get(p);
      if (prev && prev.mtimeMs === stat.mtimeMs && prev.size === stat.size) continue;
      let data;
      try {
        data = JSON.parse(fs.readFileSync(file, "utf8"));
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
      for (const res of clients) send(res, "change", { changes });
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
    watcher = fs.watch(dbDir, { recursive: true }, soon);
    watcher.on("error", () => {
    });
  } catch (error) {
    log(`file watching unavailable (${error.message}); polling instead`);
  }
  const poll = setInterval(rescan, watcher ? 2e3 : 700);
  const allowedHosts = (p) => /* @__PURE__ */ new Set([`127.0.0.1:${p}`, `localhost:${p}`, `[::1]:${p}`, `${host}:${p}`]);
  let hosts = /* @__PURE__ */ new Set();
  const json = (res, status, body) => {
    res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
    res.end(JSON.stringify(body));
  };
  const readBody = (req, limit) => new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > limit) {
        reject(Object.assign(new Error("too large"), { status: 413 }));
        req.destroy();
      } else chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
  const serveFile = (res, file, type, cache) => {
    fs.readFile(file, (error, data) => {
      if (error) return json(res, 404, { code: "not_found", message: "Not found" });
      res.writeHead(200, { "Content-Type": type, "Cache-Control": cache, "X-Content-Type-Options": "nosniff" });
      res.end(data);
    });
  };
  const server = http.createServer(async (req, res) => {
    try {
      if (!hosts.has(req.headers.host ?? "")) return json(res, 421, { code: "invalid_argument", message: "Unexpected Host header." });
      const url2 = new URL(req.url ?? "/", "http://local");
      const p = url2.pathname;
      if (req.method === "POST") {
        const origin = req.headers.origin;
        if (origin && !hosts.has(origin.replace(/^https?:\/\//, ""))) return json(res, 403, { code: "not_granted", message: "Cross-origin write refused." });
      }
      if (req.method === "GET" && (p === "/" || p === "/index.html")) return serveFile(res, path.join(EDITOR_DIR, "index.html"), "text/html; charset=utf-8", "no-store");
      if (req.method === "GET" && p === "/local-host.js") return serveFile(res, path.join(EDITOR_DIR, "local-host.js"), "text/javascript; charset=utf-8", "no-store");
      if (req.method === "GET" && /^\/assets\/[A-Za-z0-9_.-]+$/.test(p)) return serveFile(res, path.join(EDITOR_DIR, p), contentTypeOf(p), "public, max-age=31536000, immutable");
      if (p === "/favicon.ico") return res.writeHead(204).end();
      const blob = /^\/_blob\/([0-9a-f]{32})$/.exec(p);
      if (req.method === "GET" && blob) {
        const meta = readBlobMeta(root, blob[1]);
        return serveFile(res, blobFile(root, blob[1]), meta?.contentType ?? "application/octet-stream", "private, max-age=31536000, immutable");
      }
      if (req.method === "GET" && p === "/_api/session") return json(res, 200, { ok: true, kind: "dashboard", root, userId: LOCAL_USER_ID, userName: localUserName() });
      if (req.method === "GET" && p === "/_api/events") {
        res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-store", Connection: "keep-alive" });
        res.write("retry: 1500\n\n");
        rescan();
        send(res, "snapshot", { docs: snapshot() });
        clients.add(res);
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
          doc = readDoc(root, url2.searchParams.get("path"));
        } catch (error) {
          return json(res, 400, { code: "invalid_argument", message: error.message });
        }
        return json(res, 200, doc.exists ? { exists: true, data: doc.data } : { exists: false });
      }
      if (req.method === "POST" && p === "/_api/write") {
        let body;
        try {
          body = JSON.parse((await readBody(req, MAX_BATCH_BYTES + 4096)).toString("utf8"));
        } catch (error) {
          return json(res, error.status ?? 400, { code: "invalid_argument", message: error.status ? "The write is over 1 MB." : "The write is not JSON." });
        }
        try {
          const done = applyWrites(root, [{ op: body.op, path: body.path, ...body.op === "delete" ? {} : { data: body.data } }], { agent: false });
          rescan();
          return json(res, 200, { ok: true, writes: done });
        } catch (error) {
          return json(res, 400, { code: "invalid_argument", message: error.message });
        }
      }
      if (req.method === "POST" && p === "/_api/upload") {
        let bytes;
        try {
          bytes = await readBody(req, MAX_DATA_BYTES);
        } catch (error) {
          return json(res, error.status ?? 400, { code: "invalid_argument", message: error.status ? "The file is over 8 MB." : error.message });
        }
        let name = "upload";
        try {
          name = decodeURIComponent(String(req.headers["x-filename"] ?? "upload")).replace(/[\\/]/g, "_").slice(0, 200) || "upload";
        } catch {
        }
        const type = String(req.headers["content-type"] ?? "") || contentTypeOf(name);
        const result = putBlob(root, bytes, name, type);
        log(`uploaded ${name} as ${result.url}`);
        return json(res, 200, result);
      }
      return json(res, 404, { code: "not_found", message: "Not found" });
    } catch (error) {
      log(`error: ${error.stack ?? error}`);
      if (!res.headersSent) json(res, 500, { code: "unavailable", message: String(error.message ?? error) });
    }
  });
  await new Promise((resolve, reject) => {
    server.once(
      "error",
      (error) => reject(error.code === "EADDRINUSE" ? new CliError("PORT_IN_USE", `Port ${port} is in use; pick another --port, or leave it out to take a free one.`) : error)
    );
    server.listen(port, host, resolve);
  });
  const actualPort = server.address().port;
  hosts = allowedHosts(actualPort);
  const shownHost = host === "0.0.0.0" || host === "::" ? "127.0.0.1" : host.includes(":") ? `[${host}]` : host;
  const url = `http://${shownHost}:${actualPort}/`;
  const state = { kind: "dashboard", pid: process.pid, url, port: actualPort, root, startedAt: (/* @__PURE__ */ new Date()).toISOString() };
  fs.writeFileSync(path.join(root, STATE_FILE), `${JSON.stringify(state, null, 2)}
`);
  const shutdown = () => {
    if (readState(root)?.pid === process.pid) fs.rmSync(path.join(root, STATE_FILE), { force: true });
    clearInterval(poll);
    watcher?.close();
    for (const c of clients) c.end();
    server.close();
    server.closeAllConnections?.();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  process.on("SIGHUP", shutdown);
  print({ url, root, pid: process.pid }, true);
  log(`serving ${root} at ${url}`);
  return true;
}
async function open(root, flags) {
  const existing = await runningServer(root);
  if (existing) {
    print({ url: existing.url, root, pid: existing.pid, reused: true, log: path.join(root, LOG_FILE), stop: cmd("stop", root) }, true);
    return;
  }
  const logFile = path.join(root, LOG_FILE);
  const fd = fs.openSync(logFile, "a");
  const child = spawn(process.execPath, [SCRIPT, "serve", root, ...serverFlags(flags)], { detached: true, stdio: ["ignore", "ignore", fd] });
  child.unref();
  fs.closeSync(fd);
  let exited = false;
  child.once("exit", () => exited = true);
  const deadline = Date.now() + 15e3;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 120));
    const state = readState(root);
    if (state?.pid === child.pid) {
      const empty = !fs.existsSync(docFile(root, ["files", "index.html"]));
      print({ url: state.url, root, pid: state.pid, log: logFile, stop: cmd("stop", root), ...empty ? { note: "files/index.html is not written yet: the page is empty until it is." } : {} }, true);
      return;
    }
    if (exited) break;
  }
  const tail = fs.existsSync(logFile) ? fs.readFileSync(logFile, "utf8").split("\n").slice(-12).join("\n") : "";
  throw new CliError("SERVER_FAILED", `The editor server did not start. Run ${cmd("serve", root)} in the foreground to see why.${tail ? `
${tail}` : ""}`);
}
function stop(root) {
  const state = readState(root);
  if (!state || !alive(state.pid)) {
    fs.rmSync(path.join(root, STATE_FILE), { force: true });
    print({ stopped: false, message: "No editor server is running for this folder." }, true);
    return;
  }
  process.kill(state.pid, "SIGTERM");
  print({ stopped: true, pid: state.pid }, true);
}
var USAGE = `claude-dashboard \u2014 local Artifact tool for the Dashboard type

Usage:
  node scripts/artifact.mjs write-db <root> <batch.json | ->     write documents (set / update / delete), all or nothing
  node scripts/artifact.mjs read-db  <root> [<collection>[/<doc_id>]] [--text]
                                                                  read the store; --text prints a document's text raw
  node scripts/artifact.mjs upload   <root> <file> [--name n]    attach a CSV/TSV/JSON file; prints its /_blob/<id> url
  node scripts/artifact.mjs delete-asset <root> <url|id>         remove an attached file nothing names any more
  node scripts/artifact.mjs check    <root>                      check documents, files and marks; exit 1 on problems
  node scripts/artifact.mjs open     <root> [--port n]           start the editor in the background; prints {"url"}
  node scripts/artifact.mjs serve    <root> [--port n]           the same server, in the foreground
  node scripts/artifact.mjs stop     <root>                      stop the background editor

<root> is the dashboard's folder: documents at <root>/db/<collection>/<doc_id>.json, attached files in <root>/_blobs/.
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
        text = from === "-" ? fs.readFileSync(0, "utf8") : fs.readFileSync(path.resolve(from), "utf8");
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
