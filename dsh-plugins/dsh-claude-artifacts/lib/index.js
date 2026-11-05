// dsh-claude-artifacts 2.9.2: built from baoyu-design.
var define_SKILLS_default = [{ name: "claude-slides", plugin: "dsh-claude-slides", comments: true }, { name: "claude-design", plugin: "dsh-claude-design", comments: true }, { name: "claude-design-system", plugin: "dsh-claude-design-system", comments: true }, { name: "claude-dashboard", plugin: "dsh-claude-dashboard", comments: true }, { name: "claude-docs", plugin: "dsh-claude-docs", comments: true, commentsBy: "mention", requests: true }, { name: "claude-motion", plugin: "dsh-claude-motion", comments: true, requests: true }];

import { spawn as spawn2 } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync as readFileSync2 } from "node:fs";
import { createRequire } from "node:module";
import { dirname as dirname3, join as join3 } from "node:path";
import { fileURLToPath } from "node:url";

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, parse } from "node:path";

function isNewer(a, b) {
  const parts = (version) => {
    const [core = "", pre] = version.split("+")[0].split(/-(.*)/s);
    return { numbers: core.split(".").map((n) => Number.parseInt(n, 10) || 0), pre };
  };
  const left = parts(a);
  const right = parts(b);
  for (let i = 0; i < 3; i++) {
    const difference = (left.numbers[i] ?? 0) - (right.numbers[i] ?? 0);
    if (difference !== 0) return difference > 0;
  }
  if (left.pre === void 0 || right.pre === void 0) return left.pre === void 0 && right.pre !== void 0;
  return left.pre.localeCompare(right.pre, "en", { numeric: true }) > 0;
}
var base = "/api/baoyu-design.artifacts";
var listPath = base;
var openPath = `${base}.open`;
var previewPath = `${base}.preview`;
var releasePath = `${base}.release`;
var thumbnailPath = `${base}.thumbnail`;
var updatePath = `${base}.update`;
var deletePath = `${base}.delete`;
var restorePath = `${base}.restore`;
var updatesPath = `${base}.updates`;

var TITLES = {
  "claude-slides": ["project/deck.json", "title"],
  "claude-design": ["project/canvas.json", "title"],
  "claude-design-system": ["project/design-system.json", "title"],
  "claude-dashboard": ["db/dash/meta.json", "title"],
  "claude-docs": ["doc.json", "name"],
  "claude-motion": ["db/film/meta.json", "title"]
};
var OPEN_TIMEOUT_MS = 3e4;
var TITLE_MAX = 200;
var EDITOR_FILES = [".artifact-server.json", ".artifact-server.log", ".sharing.json", ".gitignore", ".DS_Store", "comments.json", "history", "exports"];
var FOLDER = {
  "claude-slides": ["project"],
  "claude-design": ["project"],
  "claude-design-system": ["project"],
  "claude-dashboard": ["db", "_blobs", "src"],
  "claude-docs": ["doc.json", "tabs", "_blobs", ".sessions.json"],
  "claude-motion": ["db", "_blobs", "src"]
};
var NOT_CONTENT = /* @__PURE__ */ new Set([...EDITOR_FILES, ".sessions.json", ".git", "node_modules"]);
var STAMP_MAX_ENTRIES = 2e4;
function dshHome() {
  const set = process.env.DSH_HOME?.trim();
  return set ? set : join(homedir(), ".dsh");
}
function artifactsDir() {
  return join(dshHome(), "baoyu-design", "artifacts");
}
var folderHash = (root) => createHash("sha256").update(root).digest("hex").slice(0, 24);
function recordFile(root) {
  return join(artifactsDir(), `${folderHash(root)}.json`);
}
function thumbnailFile(root) {
  return join(dshHome(), "baoyu-design", "thumbnails", `${folderHash(root)}.jpg`);
}
function trashDir() {
  return join(dshHome(), "baoyu-design", "trash");
}
function artifactTitle(skill, root) {
  const at = TITLES[skill];
  if (at === void 0) return null;
  try {
    const value = JSON.parse(readFileSync(join(root, at[0]), "utf8"))[at[1]];
    const title = typeof value === "string" ? value.trim() : "";
    if (title && title !== "project") return title;
  } catch {
  }
  return basename(root);
}
function isRecord(value) {
  const r = value;
  return typeof r === "object" && r !== null && r.v === 1 && typeof r.root === "string" && typeof r.skill === "string" && typeof r.plugin === "string" && typeof r.sessionId === "string" && typeof r.title === "string" && typeof r.openedAt === "string";
}
function readRecord(file) {
  try {
    const value = JSON.parse(readFileSync(file, "utf8"));
    return isRecord(value) ? value : null;
  } catch {
    return null;
  }
}
function writeWhole(file, data) {
  mkdirSync(dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tmp, data);
  renameSync(tmp, file);
}
function writeRecord(record) {
  writeWhole(recordFile(record.root), `${JSON.stringify(record, null, 2)}
`);
}
function recordOpened(skill, plugin, sessionId, root, now = /* @__PURE__ */ new Date()) {
  const file = recordFile(root);
  const before = readRecord(file);
  const mine = before?.root === root ? before : null;
  const record = {
    v: 1,
    root,
    skill,
    plugin,
    sessionId,
    title: artifactTitle(skill, root) ?? before?.title ?? basename(root),
    openedAt: now.toISOString(),
    firstOpenedAt: mine ? mine.firstOpenedAt ?? mine.openedAt : now.toISOString(),
    ...mine?.pinned ? { pinned: true } : {},
    ...mine?.thumbStamp ? { thumbStamp: mine.thumbStamp } : {}
  };
  writeRecord(record);
  return record;
}
function contentStamp(root) {
  let newest = 0;
  let entries = 0;
  const walk = (dir, top) => {
    let names;
    try {
      names = readdirSync(dir);
    } catch {
      return;
    }
    for (const name2 of names) {
      if (++entries > STAMP_MAX_ENTRIES) return;
      if (name2.endsWith(".tmp") || top && NOT_CONTENT.has(name2)) continue;
      const path = join(dir, name2);
      try {
        const stat = statSync(path);
        if (stat.isDirectory()) walk(path, false);
        else if (stat.mtimeMs > newest) newest = stat.mtimeMs;
      } catch {
      }
    }
  };
  walk(root, true);
  return newest > 0 ? new Date(newest).toISOString() : "";
}
function isShared(root) {
  try {
    return JSON.parse(readFileSync(join(root, ".sharing.json"), "utf8")).lan === true;
  } catch {
    return false;
  }
}
function isDeletable(skill, root) {
  const own = FOLDER[skill];
  if (own === void 0) return false;
  if (root === homedir() || root === parse(root).root) return false;
  try {
    return readdirSync(root).every((name2) => own.includes(name2) || EDITOR_FILES.includes(name2) || name2.endsWith(".tmp"));
  } catch {
    return false;
  }
}
function listArtifacts(openable) {
  let names;
  try {
    names = readdirSync(artifactsDir());
  } catch {
    return [];
  }
  const views = [];
  for (const name2 of names) {
    if (!name2.endsWith(".json")) continue;
    const record = readRecord(join(artifactsDir(), name2));
    if (record === null || !existsSync(record.root)) continue;
    views.push({
      root: record.root,
      skill: record.skill,
      plugin: record.plugin,
      sessionId: record.sessionId,
      title: artifactTitle(record.skill, record.root) ?? record.title,
      openedAt: record.openedAt,
      firstOpenedAt: record.firstOpenedAt ?? record.openedAt,
      updatedAt: contentStamp(record.root) || record.openedAt,
      pinned: record.pinned === true,
      shared: isShared(record.root),
      deletable: isDeletable(record.skill, record.root),
      thumbnail: record.thumbStamp !== void 0 && existsSync(thumbnailFile(record.root)) ? record.thumbStamp : null,
      openable: openable(record.skill)
    });
  }
  return views.sort((a, b) => a.openedAt < b.openedAt ? 1 : a.openedAt > b.openedAt ? -1 : 0);
}
function findArtifact(root) {
  const record = readRecord(recordFile(root));
  return record?.root === root ? record : null;
}
function scriptEnv(node) {
  const env = { ...process.env };
  if (node.env) {
    const [name2, value] = node.env.split("=");
    if (name2) env[name2] = value ?? "";
  }
  return env;
}
function runScript(node, script, args, input) {
  return new Promise((resolve, reject) => {
    const child = spawn(node.path, [script, ...args], { env: scriptEnv(node), stdio: [input === void 0 ? "ignore" : "pipe", "pipe", "pipe"], windowsHide: true });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`${args[0]} did not finish in time`));
    }, OPEN_TIMEOUT_MS);
    child.stdout?.setEncoding("utf8").on("data", (chunk) => stdout += chunk);
    child.stderr?.setEncoding("utf8").on("data", (chunk) => stderr += chunk);
    child.stdin?.end(input);
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) return resolve(firstJson(stdout));
      const failure = firstJson(stderr) ?? firstJson(stdout);
      const message = typeof failure?.message === "string" ? failure.message : stderr.trim() || `${args[0]} exited with ${code ?? "a signal"}`;
      reject(new Error(message));
    });
  });
}
async function runOpen(node, script, root) {
  const out = await runScript(node, script, ["open", root]);
  if (typeof out?.url !== "string") throw new Error("open printed no address");
  return { url: out.url, reused: out.reused === true };
}
async function renameArtifact(node, script, record, title) {
  const { root, skill } = record;
  const at = TITLES[skill];
  if (at === void 0) throw new Error(`no title to change for ${skill}`);
  if (skill === "claude-dashboard" || skill === "claude-motion") {
    const path = at[0].replace(/^db\//, "").replace(/\.json$/, "");
    await runScript(node, script, ["write-db", root, "-"], JSON.stringify([{ op: "update", path, data: { [at[1]]: title } }]));
    return;
  }
  const file = join(root, at[0]);
  const index = JSON.parse(readFileSync(file, "utf8"));
  if (skill === "claude-docs") {
    await runScript(node, script, ["update", root, JSON.stringify({ ref: { object: "project", id: String(index.id) }, payload: { name: title } })]);
    return;
  }
  writeWhole(file, `${JSON.stringify({ ...index, [at[1]]: title }, null, 2)}
`);
}
function cleanTitle(raw) {
  if (typeof raw !== "string") return null;
  const title = raw.replace(/\s+/g, " ").trim().slice(0, TITLE_MAX);
  return title || null;
}
function moveFolder(from, to) {
  mkdirSync(dirname(to), { recursive: true });
  try {
    renameSync(from, to);
  } catch (error) {
    if (error.code !== "EXDEV") throw error;
    cpSync(from, to, { recursive: true, preserveTimestamps: true });
    rmSync(from, { recursive: true, force: true });
  }
}
var TRASH_ID = /^[0-9a-f]{24}-\d+$/;
function trashArtifact(record) {
  const id = `${folderHash(record.root)}-${Date.now()}`;
  const entry = join(trashDir(), id);
  try {
    for (const name2 of readdirSync(trashDir())) {
      if (TRASH_ID.test(name2) && !existsSync(join(trashDir(), name2, "folder"))) rmSync(join(trashDir(), name2), { recursive: true, force: true });
    }
  } catch {
  }
  mkdirSync(entry, { recursive: true });
  writeFileSync(join(entry, "record.json"), `${JSON.stringify(record, null, 2)}
`);
  const thumbnail = thumbnailFile(record.root);
  if (existsSync(thumbnail)) renameSync(thumbnail, join(entry, "thumbnail.jpg"));
  const moved = isDeletable(record.skill, record.root);
  const path = join(entry, "folder", basename(record.root));
  if (moved) moveFolder(record.root, path);
  rmSync(recordFile(record.root), { force: true });
  return { trash: id, moved, path: moved ? path : record.root };
}
function restoreArtifact(id) {
  if (!TRASH_ID.test(id)) throw new Error("not a trash entry");
  const entry = join(trashDir(), id);
  const record = readRecord(join(entry, "record.json"));
  if (record === null) throw new Error("nothing to put back");
  const folder = join(entry, "folder", basename(record.root));
  if (existsSync(folder)) {
    if (existsSync(record.root)) throw new Error(`${record.root} is taken`);
    moveFolder(folder, record.root);
  }
  writeRecord(record);
  const thumbnail = join(entry, "thumbnail.jpg");
  if (existsSync(thumbnail)) {
    mkdirSync(dirname(thumbnailFile(record.root)), { recursive: true });
    renameSync(thumbnail, thumbnailFile(record.root));
  }
  rmSync(entry, { recursive: true, force: true });
  return record;
}
function firstJson(text) {
  const start2 = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start2 < 0 || end <= start2) return null;
  try {
    const value = JSON.parse(text.slice(start2, end + 1));
    return value && typeof value === "object" && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}
var json = (body, status = 200) => Response.json(body, { status, headers: { "cache-control": "no-store" } });
var notRecorded = () => json({ error: "not a recorded artifact" }, 404);
var notInstalled = (record) => json({ error: `the ${record.plugin} plugin is not installed` }, 409);
function registerRoutes(routes, host, opened) {
  const { node } = host;
  routes.register({
    path: listPath,
    methods: ["GET"],
    requestBody: "buffered",
    fetch: () => {
      const known = /* @__PURE__ */ new Map();
      const openable = (skill) => {
        if (!known.has(skill)) known.set(skill, host.script(skill) !== null);
        return known.get(skill) === true;
      };
      return Promise.resolve(json({ artifacts: listArtifacts(openable), ...host.places() }));
    }
  });
  routes.register({
    path: updatesPath,
    methods: ["GET"],
    requestBody: "buffered",
    fetch: async () => json(await host.updates())
  });
  routes.register({
    path: openPath,
    methods: ["POST"],
    requestBody: "buffered",
    fetch: async (request) => {
      const root = new URL(request.url).searchParams.get("root") ?? "";
      const record = root ? findArtifact(root) : null;
      if (record === null) return notRecorded();
      if (!existsSync(root)) return json({ error: "the folder is gone" }, 404);
      const script = host.script(record.skill);
      if (script === null) return notInstalled(record);
      try {
        const { url, reused } = await runOpen(node, script, root);
        const again = recordOpened(record.skill, record.plugin, record.sessionId, root);
        opened(again, script);
        return json({ url, reused, sessionId: again.sessionId, title: again.title });
      } catch (error) {
        return json({ error: error.message }, 500);
      }
    }
  });
  const rootOf = (request) => new URL(request.url).searchParams.get("root") ?? "";
  const recorded = (root) => {
    const record = root ? findArtifact(root) : null;
    return record !== null && existsSync(root) ? record : null;
  };
  const started = /* @__PURE__ */ new Map();
  routes.register({
    path: previewPath,
    methods: ["POST"],
    requestBody: "buffered",
    fetch: async (request) => {
      const root = rootOf(request);
      const record = recorded(root);
      if (record === null) return notRecorded();
      const script = host.script(record.skill);
      if (script === null) return notInstalled(record);
      try {
        const { url, reused } = await runOpen(node, script, root);
        if (!reused) started.set(root, record.openedAt);
        return json({ url, reused });
      } catch (error) {
        return json({ error: error.message }, 500);
      }
    }
  });
  routes.register({
    path: releasePath,
    methods: ["POST"],
    requestBody: "buffered",
    fetch: async (request) => {
      const root = rootOf(request);
      const since = started.get(root);
      started.delete(root);
      const record = recorded(root);
      if (record === null) return notRecorded();
      if (since === void 0 || since !== record.openedAt || new URL(request.url).searchParams.get("keep") === "1") return json({ stopped: false });
      const script = host.script(record.skill);
      if (script === null) return notInstalled(record);
      try {
        await runScript(node, script, ["stop", root]);
        return json({ stopped: true });
      } catch (error) {
        return json({ error: error.message }, 500);
      }
    }
  });
  routes.register({
    path: thumbnailPath,
    methods: ["GET", "POST"],
    requestBody: "buffered",
    fetch: async (request) => {
      const root = rootOf(request);
      const record = root ? findArtifact(root) : null;
      if (record === null) return json({ error: "not a recorded artifact" }, 404);
      if (request.method === "GET") {
        try {
          const bytes2 = readFileSync(thumbnailFile(root));
          return new Response(bytes2, { headers: { "content-type": "image/jpeg", "cache-control": "private, max-age=31536000, immutable" } });
        } catch {
          return json({ error: "no thumbnail yet" }, 404);
        }
      }
      const bytes = new Uint8Array(await request.arrayBuffer());
      if (bytes.length < 3 || bytes[0] !== 255 || bytes[1] !== 216) return json({ error: "a thumbnail is a JPEG" }, 400);
      writeWhole(thumbnailFile(root), bytes);
      const stamp = contentStamp(root) || record.openedAt;
      writeRecord({ ...findArtifact(root) ?? record, thumbStamp: stamp });
      return json({ thumbnail: stamp, updatedAt: stamp });
    }
  });
  routes.register({
    path: updatePath,
    methods: ["POST"],
    requestBody: "buffered",
    fetch: async (request) => {
      const root = rootOf(request);
      const record = recorded(root);
      if (record === null) return notRecorded();
      const patch = await request.json().catch(() => null);
      if (patch === null || typeof patch !== "object") return json({ error: "not a JSON object" }, 400);
      try {
        if (patch.title !== void 0) {
          const title = cleanTitle(patch.title);
          if (title === null) return json({ error: "a title cannot be empty" }, 400);
          const script = host.script(record.skill);
          if (script === null) return notInstalled(record);
          await renameArtifact(node, script, record, title);
        }
        const now = findArtifact(root) ?? record;
        const next = { ...now, title: artifactTitle(record.skill, root) ?? now.title };
        if (patch.pinned === true) next.pinned = true;
        else if (patch.pinned === false) delete next.pinned;
        writeRecord(next);
        return json({ title: next.title, pinned: next.pinned === true });
      } catch (error) {
        return json({ error: error.message }, 500);
      }
    }
  });
  routes.register({
    path: deletePath,
    methods: ["POST"],
    requestBody: "buffered",
    fetch: async (request) => {
      const root = rootOf(request);
      const record = recorded(root);
      if (record === null) return notRecorded();
      try {
        const script = host.script(record.skill);
        if (script !== null && isDeletable(record.skill, root)) await runScript(node, script, ["stop", root]).catch(() => null);
        started.delete(root);
        return json(trashArtifact(record));
      } catch (error) {
        return json({ error: error.message }, 500);
      }
    }
  });
  routes.register({
    path: restorePath,
    methods: ["POST"],
    requestBody: "buffered",
    fetch: (request) => {
      try {
        return Promise.resolve(json({ root: restoreArtifact(new URL(request.url).searchParams.get("trash") ?? "").root }));
      } catch (error) {
        return Promise.resolve(json({ error: error.message }, 400));
      }
    }
  });
}

var HOST = Symbol.for("baoyu-design/dsh-artifacts-host");
function hostHub() {
  const g = globalThis;
  return g[HOST] ??= { members: [] };
}
function joinHost(start2) {
  const hub = hostHub();
  const member = { start: start2 };
  hub.members.push(member);
  if (hub.members[0] === member) start2();
  return () => {
    const first = hub.members[0] === member;
    hub.members.splice(hub.members.indexOf(member), 1);
    if (first) hub.members[0]?.start();
  };
}

import { statSync as statSync2 } from "node:fs";
import { delimiter, dirname as dirname2, isAbsolute, join as join2 } from "node:path";
function isFile(path) {
  try {
    return statSync2(path).isFile();
  } catch {
    return false;
  }
}
function resolveNode(plugin, config = {}) {
  if (config.node !== void 0) {
    if (!isAbsolute(config.node) || !isFile(config.node)) {
      throw new Error(`${plugin}: config.node must be an absolute path to an executable file: ${config.node}`);
    }
    return { path: config.node, from: "config" };
  }
  if (process.versions.electron === void 0) return { path: process.execPath, from: "host" };
  const exe = process.platform === "win32" ? "node.exe" : "node";
  const runtime = ["runtime", "primary-runtime", "dependencies", "node", "bin", exe];
  const roots = [];
  const resourcesPath = process.resourcesPath;
  if (typeof resourcesPath === "string") roots.push(resourcesPath);
  let dir = dirname2(process.execPath);
  for (let i = 0; i < 6; i++) {
    roots.push(join2(dir, "Resources"), join2(dir, "resources"));
    const parent = dirname2(dir);
    if (parent === dir) break;
    dir = parent;
  }
  for (const root of roots) {
    const candidate = join2(root, ...runtime);
    if (isFile(candidate)) return { path: candidate, from: "desktop runtime" };
  }
  for (const entry of (process.env.PATH ?? "").split(delimiter)) {
    if (entry === "" || !isAbsolute(entry)) continue;
    const candidate = join2(entry, exe);
    if (isFile(candidate)) return { path: candidate, from: "PATH" };
  }
  return { path: process.execPath, env: "ELECTRON_RUN_AS_NODE=1", from: "electron" };
}

var NPM = "https://registry.npmjs.org/";
var LOOKUP_MS = 8e3;
var FRESH_MS = 60 * 6e4;
var TARBALL = /^https?:\/\/.+\.tgz$/i;
function fromRegistry(name2, source) {
  return source !== void 0 && (source.startsWith(`${name2}@`) || TARBALL.test(source));
}
var withSlash = (url) => url.endsWith("/") ? url : `${url}/`;
async function latestOn(registry, name2) {
  try {
    const response = await fetch(`${registry}${name2}`, {
      headers: { accept: "application/vnd.npm.install-v1+json" },
      signal: AbortSignal.timeout(LOOKUP_MS)
    });
    if (!response.ok) return null;
    const doc = await response.json();
    const version = doc["dist-tags"]?.latest;
    if (typeof version !== "string") return null;
    const tarball = doc.versions?.[version]?.dist?.tarball;
    return typeof tarball === "string" && TARBALL.test(tarball) ? { version, tarball, registry } : null;
  } catch {
    return null;
  }
}
function updateChecker(names, manager) {
  const known = /* @__PURE__ */ new Map();
  const releaseOf = (name2, asked) => {
    const kept = known.get(name2);
    if (kept !== void 0 && Date.now() - kept.at < FRESH_MS) return kept.release;
    const release = (async () => {
      for (const registry of await asked()) {
        const found = await latestOn(registry, name2);
        if (found !== null) return found;
      }
      return null;
    })();
    const entry = { at: Date.now(), release };
    known.set(name2, entry);
    void release.then((found) => {
      if (found === null && known.get(name2) === entry) known.delete(name2);
    });
    return release;
  };
  return async () => {
    const service = manager();
    if (service === void 0) return { updates: [], failed: [] };
    const ours = (await service.listBundles()).filter((b) => b.installed === true && names.includes(b.name) && typeof b.version === "string" && fromRegistry(b.name, b.source));
    let plan;
    const asked = () => plan ??= service.registries().then(({ registry, fallbackRegistries, resolved }) => [...new Set([registry ?? resolved ?? NPM, ...fallbackRegistries ?? []].map(withSlash))]);
    const updates = [];
    const failed = [];
    await Promise.all(
      ours.map(async (bundle) => {
        const release = await releaseOf(bundle.name, asked);
        if (release === null) failed.push(bundle.name);
        else if (isNewer(release.version, bundle.version)) {
          updates.push({ name: bundle.name, version: bundle.version, latest: release.version, spec: release.tarball, registry: release.registry, enabled: bundle.enabled !== false });
        }
      })
    );
    updates.sort((a, b) => ours.findIndex((o) => o.name === a.name) - ours.findIndex((o) => o.name === b.name));
    return { updates, failed };
  };
}

var SKILLS = define_SKILLS_default;
var PLUGIN = "dsh-claude-artifacts";
var packageRoot = fileURLToPath(new URL("../", import.meta.url));
var name = "claude-artifacts";
var COMMENT_SOURCE = "baoyu-design-comment";
var SUMMARY_MAX = 120;
var SESSION_CHECK_MS = 6e4;
var RETRY_MS = 5e3;
var MAX_QUICK_FAILURES = 3;
var IDLE_CHECK_MS = 500;
var AGENT_GRACE_MS = 3e4;
var TURN_START_MS = 3e3;
var TURN_MAX_MS = 30 * 6e4;
function jsonObject(text) {
  const trimmed = text.trim();
  const starts = [0];
  for (let i = trimmed.indexOf("\n{"); i >= 0; i = trimmed.indexOf("\n{", i + 1)) starts.push(i + 1);
  for (const start2 of starts) {
    if (trimmed[start2] !== "{") continue;
    const end = trimmed.lastIndexOf("}");
    for (let stop = end; stop > start2; stop = trimmed.lastIndexOf("}", stop - 1)) {
      try {
        const value = JSON.parse(trimmed.slice(start2, stop + 1));
        if (value && typeof value === "object" && !Array.isArray(value)) return value;
      } catch {
      }
    }
  }
  return null;
}
function jsonEnd(text, start2) {
  let depth = 0;
  let inString = false;
  for (let i = start2; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (c === "\\") i++;
      else if (c === '"') inString = false;
    } else if (c === '"') inString = true;
    else if (c === "{" || c === "[") depth++;
    else if ((c === "}" || c === "]") && --depth === 0) return i;
  }
  return -1;
}
function jsonObjects(text) {
  const found = [];
  const starts = text.startsWith("{") ? [0] : [];
  for (let i = text.indexOf("\n{"); i >= 0; i = text.indexOf("\n{", i + 1)) starts.push(i + 1);
  let after = 0;
  for (const start2 of starts) {
    if (start2 < after) continue;
    const end = jsonEnd(text, start2);
    if (end < 0) continue;
    try {
      const value = JSON.parse(text.slice(start2, end + 1));
      if (value && typeof value === "object" && !Array.isArray(value)) {
        found.push(value);
        after = end + 1;
      }
    } catch {
    }
  }
  return found;
}
function bashStdout(result) {
  const value = result.value;
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    if (value.kind !== "foreground" || value.exitCode !== 0) return null;
    return typeof value.stdout?.text === "string" ? value.stdout.text : null;
  }
  const text = result.content.map((block) => block.type === "text" ? block.text ?? "" : "").join("\n");
  return text || null;
}
function openedEditor(exec, result) {
  if (exec.name !== "bash" && exec.name !== "pwsh" || exec.agent === void 0 || result.isError) return null;
  const args = exec.arguments;
  const command = args?.command;
  if (typeof command !== "string" || args?.run_in_background === true) return null;
  if (!/(?:^|[\s"'])open(?:[\s"']|$)/.test(command)) return null;
  const stdout = bashStdout(result);
  const opened = stdout === null ? void 0 : jsonObjects(stdout).findLast((o) => typeof o.root === "string" && typeof o.url === "string");
  if (typeof opened?.root !== "string" || typeof opened.url !== "string") return null;
  const skill = skillOfScript(typeof opened.stop === "string" ? opened.stop : command);
  if (skill === void 0) return null;
  return { session: String(exec.agent.id), skill, root: opened.root, url: opened.url };
}
function skillOfScript(text) {
  return SKILLS.find((skill) => new RegExp(`[/\\\\]${skill.name}[/\\\\]scripts[/\\\\]artifact\\.mjs`).test(text));
}
var bound = (text) => text.length <= SUMMARY_MAX ? text : `${text.slice(0, SUMMARY_MAX - 1)}…`;
function commentMessage(skill, plugin, out, root) {
  const title = typeof out.title === "string" && out.title ? out.title : root.split(/[\\/]/).pop() || root;
  const url = typeof out.url === "string" ? out.url : "";
  const threads = (out.threads ?? []).map((t) => {
    const mine = (t.messages ?? []).filter((m) => m.from === "user");
    return { id: t.id, where: t.where ?? "", text: (mine[mine.length - 1] ?? t.messages?.[t.messages.length - 1])?.text ?? "" };
  });
  const requests = (out.requests ?? []).filter((r) => r && typeof r.text === "string").map((r) => ({ id: String(r.id), label: typeof r.label === "string" ? r.label : "", text: r.text }));
  const { next: _next, timedOut: _timedOut, about: _about, ...rest } = out;
  const how = skill.commentsBy === "mention" ? "read the block, change the doc with `update`, then `comment-reply`" : "change the files, then `comment-reply`";
  const where = `"${title}" (${url || root})`;
  const heading = threads.length > 0 && requests.length > 0 ? `Comments, and requests from the page's buttons, sent to you from the editor of ${where}:` : threads.length > 0 ? `Comments sent to you from the editor of ${where}:` : `Requests sent to you by the buttons on ${where}:`;
  const text = [
    heading,
    "",
    "```json",
    JSON.stringify(rest, null, 2),
    "```",
    "",
    ...threads.length > 0 ? [`Handle the comments as Comments says (${how}).`] : [],
    ...requests.length > 0 ? [
      "Each request is one of the page's buttons (`label`) asking for its `text`: those are the user's words, as if",
      "typed here. Handle each as the skill says for those words."
    ] : [],
    'Run the script as "Running the calls in DeepSeek Harness" says.',
    "DeepSeek Harness is already waiting for the next ones: do not run `comments --wait`."
  ].join("\n");
  const first = threads[0];
  const asked = requests[0];
  const summary = bound(
    first ? `Comment on "${title}": ${first.text.replace(/\s+/g, " ")}`.trim() : `${asked?.label || "Request"} on "${title}": ${(asked?.text ?? "").replace(/\s+/g, " ")}`.trim()
  );
  const message = {
    role: "user",
    id: randomUUID(),
    content: [{ type: "text", text }],
    source: {
      kind: COMMENT_SOURCE,
      form: "notice",
      summary,
      plugin,
      title,
      url,
      root,
      threads,
      ...requests.length > 0 ? { requests } : {}
    }
  };
  return Object.freeze(message);
}
var CommentWatcher = class {
  watches = /* @__PURE__ */ new Map();
  check;
  ctx;
  node;
  constructor(ctx, node) {
    this.ctx = ctx;
    this.node = node;
    this.check = setInterval(() => this.dropGoneSessions(), SESSION_CHECK_MS);
    this.check.unref?.();
  }
  log(level, message) {
    this.ctx.logger?.[level]?.(`${PLUGIN}: ${message}`);
  }
  agent(session) {
    return this.ctx.get("agents")?.get(session);
  }
  watch(skill, script, session, root) {
    const key = `${session}\0${root}`;
    if (this.watches.has(key)) return;
    const watch = { skill, script, child: null, stopped: false, quickFailures: 0, graceUntil: Date.now() + AGENT_GRACE_MS };
    this.watches.set(key, watch);
    this.log("info", `waiting for comments on ${root}`);
    this.run(key, session, root, watch);
  }
  stop(key, watch, why) {
    if (watch.stopped) return;
    watch.stopped = true;
    if (watch.retry) clearTimeout(watch.retry);
    watch.child?.kill();
    watch.child = null;
    if (this.watches.get(key) === watch) this.watches.delete(key);
    this.log("info", `stopped waiting for comments (${why})`);
  }
  run(key, session, root, watch) {
    watch.retry = void 0;
    if (watch.stopped) return;
    if (this.agent(session) === void 0) {
      if (Date.now() >= watch.graceUntil) return this.stop(key, watch, "the session is gone");
      watch.retry = setTimeout(() => this.run(key, session, root, watch), IDLE_CHECK_MS);
      return;
    }
    const started = Date.now();
    const child = spawn2(this.node.path, [watch.script, "comments", root, "--wait"], { env: scriptEnv(this.node), stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    watch.child = child;
    let stdout = "";
    let stderr = "";
    child.stdout?.setEncoding("utf8").on("data", (chunk) => stdout += chunk);
    child.stderr?.setEncoding("utf8").on("data", (chunk) => stderr += chunk);
    child.on("error", (error) => this.stop(key, watch, `the wait did not start: ${error.message}`));
    child.on("close", (code) => {
      if (watch.child === child) watch.child = null;
      if (watch.stopped) return;
      if (code === 0) {
        watch.quickFailures = 0;
        const out = jsonObject(stdout);
        const came = (list) => Array.isArray(list) && list.length > 0;
        if (out && (came(out.threads) || came(out.requests))) {
          this.deliver(session, watch.skill, out, root);
          return this.runWhenIdle(key, session, root, watch);
        }
        this.run(key, session, root, watch);
        return;
      }
      const failure = jsonObject(stderr);
      const reason = typeof failure?.code === "string" ? failure.code : `exit ${code ?? "signal"}`;
      if (failure && typeof failure.code === "string") return this.stop(key, watch, reason);
      if (Date.now() - started < RETRY_MS && ++watch.quickFailures > MAX_QUICK_FAILURES) return this.stop(key, watch, reason);
      watch.retry = setTimeout(() => this.run(key, session, root, watch), RETRY_MS);
    });
  }
  /** Start the next wait once the agent is done with the batch it was just handed. */
  runWhenIdle(key, session, root, watch) {
    const handed = Date.now();
    let working = false;
    const look = () => {
      watch.retry = void 0;
      if (watch.stopped) return;
      const agent = this.agent(session);
      if (agent === void 0) return this.stop(key, watch, "the session is gone");
      const idle = agent.status === "idle";
      if (!idle) working = true;
      const waited = Date.now() - handed;
      if (idle && (working || waited > TURN_START_MS) || waited > TURN_MAX_MS) return this.run(key, session, root, watch);
      watch.retry = setTimeout(look, IDLE_CHECK_MS);
    };
    look();
  }
  deliver(session, skill, out, root) {
    const agent = this.agent(session);
    if (agent === void 0) return;
    const message = commentMessage(skill, skill.plugin, out, root);
    try {
      if (agent.status === "idle") agent.followup(message);
      else agent.inject(message);
    } catch (error) {
      this.log("warn", `could not hand the comments or requests to the agent: ${error.message}`);
    }
  }
  dropGoneSessions() {
    for (const [key, watch] of [...this.watches]) {
      const session = key.slice(0, key.indexOf("\0"));
      if (this.agent(session) === void 0 && Date.now() >= watch.graceUntil) this.stop(key, watch, "the session is gone");
    }
  }
  dispose() {
    clearInterval(this.check);
    for (const [key, watch] of [...this.watches]) this.stop(key, watch, "the plugin stopped");
  }
};
function pluginFinder(ctx) {
  const inProfile = (skill) => {
    if (ctx.baseUrl === void 0) return null;
    try {
      return createRequire(ctx.baseUrl).resolve(`${skill.plugin}/package.json`);
    } catch {
      return null;
    }
  };
  return (skill) => {
    for (const manifest of [inProfile(skill), join3(packageRoot, "..", skill.plugin, "package.json")]) {
      if (manifest === null) continue;
      const script = join3(dirname3(manifest), "skills", skill.name, "scripts", "artifact.mjs");
      if (!isFile(script)) continue;
      try {
        const { dsh } = JSON.parse(readFileSync2(manifest, "utf8"));
        return { script, ownHost: dsh?.client !== void 0 };
      } catch {
      }
    }
    return null;
  };
}
function skillPlaces(ctx) {
  const loader = ctx.get("loader");
  const presets = ctx.get("agentPresets");
  const rows = /* @__PURE__ */ new Set();
  for (const entry of loader?.entries?.() ?? []) if (!entry.disabled && entry.fiber !== void 0) rows.add(entry.options.name);
  const compositions = presets?.inspectCompositions?.() ?? [];
  return {
    skills: SKILLS.map((skill) => ({
      skill: skill.name,
      plugin: skill.plugin,
      everywhere: rows.has(skill.plugin),
      presets: [...new Set(compositions.filter((c) => c.modules.some((m) => m.moduleName === skill.plugin)).map((c) => c.id))]
    })),
    ...typeof presets?.defaultId === "string" ? { defaultPreset: presets.defaultId } : {}
  };
}
function start(ctx, node) {
  const find = pluginFinder(ctx);
  const watcher = new CommentWatcher(ctx, node);
  ctx.effect(() => () => watcher.dispose(), `${PLUGIN}: comment waits`);
  ctx.on("tools/result", (exec, result) => {
    const opened = openedEditor(exec, result);
    if (opened === null) return;
    const installed = find(opened.skill);
    if (installed === null || installed.ownHost) return;
    if (opened.skill.comments) watcher.watch(opened.skill, installed.script, opened.session, opened.root);
    try {
      recordOpened(opened.skill.name, opened.skill.plugin, opened.session, opened.root);
    } catch (error) {
      ctx.logger?.warn?.(`${PLUGIN}: could not note ${opened.root} for the Artifacts page: ${error.message}`);
    }
  });
  const updates = updateChecker([PLUGIN, ...SKILLS.map((skill) => skill.plugin)], () => ctx.get("pluginManager"));
  ctx.inject?.(["connection"], (sub) => {
    registerRoutes(
      sub.connection.fetch,
      {
        node,
        script: (name2) => {
          const skill = SKILLS.find((s) => s.name === name2);
          return skill === void 0 ? null : find(skill)?.script ?? null;
        },
        places: () => skillPlaces(ctx),
        updates
      },
      (record, script) => {
        const skill = SKILLS.find((s) => s.name === record.skill);
        if (skill?.comments) watcher.watch(skill, script, record.sessionId, record.root);
      }
    );
  });
}
function apply(ctx, config = {}) {
  const node = resolveNode(PLUGIN, config ?? {});
  const leave = joinHost(() => start(ctx, node));
  ctx.effect(() => leave, `${PLUGIN}: the one running`);
}
export {
  COMMENT_SOURCE,
  apply,
  commentMessage,
  jsonObject,
  jsonObjects,
  name,
  openedEditor
};
