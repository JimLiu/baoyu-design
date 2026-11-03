// dsh-claude-design-system 2.8.0: built from baoyu-design.
var define_PLUGIN_default = { name: "claude-design-system", provider: "dsh-claude-design-system", skills: [{ name: "claude-design-system", description: "Create and revise design systems in the Design System artifact format (project/design-system.json, tokens.json, a README brand book, component previews, fonts and asset groups) as local files, then open them in a local design-system page where the user can browse and edit tokens, type, components and assets. Use when the user asks for a design system or brand kit in this format, built from a code repository, a design tool or scratch, names claude-design-system or the Design System type, or wants to revise a folder that holds project/design-system.json. claude-slides and claude-design install these systems. A free-form HTML style guide, UI kit or token page is baoyu-design's.", comments: true }] };

import { spawn as spawn2 } from "node:child_process";
import { randomUUID } from "node:crypto";
import { statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { basename as basename2, delimiter, dirname, isAbsolute, join as join2, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";

var listPath = (skill) => `/api/baoyu-design.${skill}.artifacts`;
var openPath = (skill) => `/api/baoyu-design.${skill}.artifacts.open`;

var TITLES = {
  "claude-slides": ["project/deck.json", "title"],
  "claude-design": ["project/canvas.json", "title"],
  "claude-design-system": ["project/design-system.json", "title"],
  "claude-dashboard": ["db/dash/meta.json", "title"],
  "claude-docs": ["doc.json", "name"],
  "claude-motion": ["db/film/meta.json", "title"]
};
var OPEN_TIMEOUT_MS = 3e4;
function dshHome() {
  const set = process.env.DSH_HOME?.trim();
  return set ? set : join(homedir(), ".dsh");
}
function artifactsDir() {
  return join(dshHome(), "baoyu-design", "artifacts");
}
function recordFile(root) {
  return join(artifactsDir(), `${createHash("sha256").update(root).digest("hex").slice(0, 24)}.json`);
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
function recordOpened(skill, plugin, sessionId, root, now = /* @__PURE__ */ new Date()) {
  const file = recordFile(root);
  const before = readRecord(file);
  const record = {
    v: 1,
    root,
    skill,
    plugin,
    sessionId,
    title: artifactTitle(skill, root) ?? before?.title ?? basename(root),
    openedAt: now.toISOString(),
    firstOpenedAt: before?.root === root ? before.firstOpenedAt ?? before.openedAt : now.toISOString()
  };
  mkdirSync(artifactsDir(), { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(record, null, 2)}
`);
  renameSync(tmp, file);
  return record;
}
function listArtifacts() {
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
      openedAt: record.openedAt
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
function runOpen(node, script, root) {
  return new Promise((resolve, reject) => {
    const child = spawn(node.path, [script, "open", root], { env: scriptEnv(node), stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("the editor did not start in time"));
    }, OPEN_TIMEOUT_MS);
    child.stdout?.setEncoding("utf8").on("data", (chunk) => stdout += chunk);
    child.stderr?.setEncoding("utf8").on("data", (chunk) => stderr += chunk);
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      const out = firstJson(stdout);
      if (code === 0 && typeof out?.url === "string") return resolve({ url: out.url, reused: out.reused === true });
      const failure = firstJson(stderr);
      const message = typeof failure?.message === "string" ? failure.message : stderr.trim() || `open exited with ${code ?? "a signal"}`;
      reject(new Error(message));
    });
  });
}
function firstJson(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const value = JSON.parse(text.slice(start, end + 1));
    return value && typeof value === "object" && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}
var json = (body, status = 200) => Response.json(body, { status, headers: { "cache-control": "no-store" } });
function registerRoutes(routes, skill, opened) {
  routes.register({
    path: listPath(skill.name),
    methods: ["GET"],
    requestBody: "buffered",
    fetch: () => Promise.resolve(json({ artifacts: listArtifacts() }))
  });
  routes.register({
    path: openPath(skill.name),
    methods: ["POST"],
    requestBody: "buffered",
    fetch: async (request) => {
      const root = new URL(request.url).searchParams.get("root") ?? "";
      const record = root ? findArtifact(root) : null;
      if (record === null || record.skill !== skill.name) return json({ error: "not a recorded artifact of this skill" }, 404);
      if (!existsSync(root)) return json({ error: "the folder is gone" }, 404);
      try {
        const { url, reused } = await runOpen(skill.node, skill.script, root);
        const again = recordOpened(skill.name, skill.plugin, record.sessionId, root);
        opened(again);
        return json({ url, reused, sessionId: again.sessionId, title: again.title });
      } catch (error) {
        return json({ error: error.message }, 500);
      }
    }
  });
}

var PLUGIN = define_PLUGIN_default;
var name = PLUGIN.name;
var inject = ["skills"];
var BUNDLED_SKILL_RANK = 600;
var packageRoot = fileURLToPath(new URL("../", import.meta.url));
function isFile(path) {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}
function resolveNode(config = {}) {
  if (config.node !== void 0) {
    if (!isAbsolute(config.node) || !isFile(config.node)) {
      throw new Error(`${PLUGIN.name}: config.node must be an absolute path to an executable file: ${config.node}`);
    }
    return { path: config.node, from: "config" };
  }
  if (process.versions.electron === void 0) return { path: process.execPath, from: "host" };
  const exe = process.platform === "win32" ? "node.exe" : "node";
  const runtime = ["runtime", "primary-runtime", "dependencies", "node", "bin", exe];
  const roots = [];
  const resourcesPath = process.resourcesPath;
  if (typeof resourcesPath === "string") roots.push(resourcesPath);
  let dir = dirname(process.execPath);
  for (let i = 0; i < 6; i++) {
    roots.push(join2(dir, "Resources"), join2(dir, "resources"));
    const parent = dirname(dir);
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
function shellQuote(path) {
  return `"${path.replace(/(["\\$`])/g, "\\$1")}"`;
}
function runtimeSection(skill, skillDir, node) {
  const script = join2(skillDir, "scripts", "artifact.mjs");
  const run = (...args) => [node.env, shellQuote(node.path), shellQuote(script), ...args].filter(Boolean).join(" ");
  const written = skill.scriptAlias === void 0 ? "`node <this skill's folder>/scripts/artifact.mjs <command>`" : `\`node $${skill.scriptAlias} <command>\` (\`${skill.scriptAlias}\` being \`<this skill's folder>/scripts/artifact.mjs\`)`;
  const lines = [
    "",
    "",
    "## Running the calls in DeepSeek Harness",
    "",
    "Wherever these pages, or the script's own output (its `stop`, `next` and other hints), say",
    `${written}, run this in the shell instead, with the quotes (the paths can contain spaces):`,
    "",
    "```sh",
    run("<command> …"),
    "```",
    "",
    "`open` prints the editor's `url` (on 127.0.0.1): give it to the user as a Markdown link. In the DeepSeek Harness",
    "app a chat link opens in the right sidebar's Browser, next to this conversation."
  ];
  if (skill.comments) {
    const sent = skill.commentsBy === "mention" ? "A comment, reply or edit in the viewer that says `@agent` is sent to you (the viewer has no Send to Agent box)." : "The editor shows **Send to Agent** on a comment while comments can reach you; a comment sent with it is sent to you.";
    lines.push(
      "",
      "### Comments sent to you from the editor",
      "",
      sent,
      "Here DeepSeek Harness waits for them for you: after you run `open` it runs `comments <root> --wait` itself, and",
      "each comment sent to you arrives in this conversation as a message with the threads (it wakes you when you are",
      "idle; the next one is held until you are done with this one, so the page shows it as waiting its turn). Handle it",
      "as Comments says",
      skill.commentsBy === "mention" ? "(read the block, change the doc with `update`, then `comment-reply`)." : "(change the files, then `comment-reply`).",
      "So do not start `comments --wait` yourself, where Comments says to: run `open` in the foreground (not",
      "`run_in_background`), and the wait starts with it. It stops when the editor stops; after `stop`, the next `open`",
      "starts it again.",
      ...skill.commentsBy === "mention" ? ["", "When you first give the link, tell the user that a comment with `@agent` in it reaches you (type `@` and pick agent)."] : [],
      ...skill.requests ? [
        "",
        "The page's buttons reach you the same way: a request one of them sends arrives as such a message, under",
        "`requests` (its words in `text`, the button in `label`). Those are the user's words, as if typed here: handle",
        "them as this skill says for those words."
      ] : []
    );
  }
  return lines.join("\n");
}
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
  for (const start of starts) {
    if (trimmed[start] !== "{") continue;
    const end = trimmed.lastIndexOf("}");
    for (let stop = end; stop > start; stop = trimmed.lastIndexOf("}", stop - 1)) {
      try {
        const value = JSON.parse(trimmed.slice(start, stop + 1));
        if (value && typeof value === "object" && !Array.isArray(value)) return value;
      } catch {
      }
    }
  }
  return null;
}
function jsonEnd(text, start) {
  let depth = 0;
  let inString = false;
  for (let i = start; i < text.length; i++) {
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
  for (const start of starts) {
    if (start < after) continue;
    const end = jsonEnd(text, start);
    if (end < 0) continue;
    try {
      const value = JSON.parse(text.slice(start, end + 1));
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
function openedEditor(script, exec, result) {
  if (exec.name !== "bash" || exec.agent === void 0 || result.isError) return null;
  const args = exec.arguments;
  const command = args?.command;
  if (typeof command !== "string" || args?.run_in_background === true) return null;
  if (!/(?:^|[\s"'])open(?:[\s"']|$)/.test(command)) return null;
  const stdout = bashStdout(result);
  const opened = stdout === null ? void 0 : jsonObjects(stdout).findLast((o) => typeof o.root === "string" && typeof o.url === "string");
  if (typeof opened?.root !== "string" || typeof opened.url !== "string") return null;
  if (!ranScript(script, command, opened.stop)) return null;
  return { session: String(exec.agent.id), root: opened.root, url: opened.url };
}
function ranScript(script, command, stop) {
  if (typeof stop !== "string") return command.includes(script);
  if (stop.includes(script)) return true;
  const folder = basename2(dirname(dirname(script)));
  return new RegExp(`[/\\\\]${folder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[/\\\\]scripts[/\\\\]artifact\\.mjs`).test(stop);
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
  skill;
  script;
  node;
  constructor(ctx, skill, script, node) {
    this.ctx = ctx;
    this.skill = skill;
    this.script = script;
    this.node = node;
    this.check = setInterval(() => this.dropGoneSessions(), SESSION_CHECK_MS);
    this.check.unref?.();
  }
  log(level, message) {
    this.ctx.logger?.[level]?.(`${PLUGIN.name}: ${message}`);
  }
  agent(session) {
    return this.ctx.get("agents")?.get(session);
  }
  watch(session, root) {
    const key = `${session}\0${root}`;
    if (this.watches.has(key)) return;
    const watch = { child: null, stopped: false, quickFailures: 0, graceUntil: Date.now() + AGENT_GRACE_MS };
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
    const child = spawn2(this.node.path, [this.script, "comments", root, "--wait"], { env: scriptEnv(this.node), stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
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
          this.deliver(session, out, root);
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
  deliver(session, out, root) {
    const agent = this.agent(session);
    if (agent === void 0) return;
    const message = commentMessage(this.skill, PLUGIN.provider, out, root);
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
function skillBody(raw, path) {
  const frontmatter = /^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/u.exec(raw);
  if (frontmatter === null) throw new Error(`${PLUGIN.name}: ${path} has no YAML frontmatter`);
  return raw.slice(frontmatter[0].length).trim();
}
function apply(ctx, config = {}) {
  const node = resolveNode(config ?? {});
  const skills = new Map(PLUGIN.skills.map((skill) => [skill.name, skill]));
  const candidates = PLUGIN.skills.map(({ name: skillName, description }) => {
    const directory = join2(packageRoot, "skills", skillName);
    const path = join2(directory, "SKILL.md");
    if (!isFile(path)) throw new Error(`${PLUGIN.name}: ${path} is missing`);
    return {
      name: skillName,
      description,
      invocation: { modelInvocable: true, userInvocable: true },
      provider: PLUGIN.provider,
      source: "bundled",
      rank: BUNDLED_SKILL_RANK,
      path,
      resourceBase: { kind: "directory", path: directory.split(sep).join("/") }
    };
  });
  const provider = {
    name: PLUGIN.provider,
    list: () => Promise.resolve(candidates),
    async get(candidate, options) {
      const { rank: _rank, ...summary } = candidate;
      const skill = skills.get(candidate.name);
      if (skill === void 0) throw new Error(`${PLUGIN.name}: no skill named ${candidate.name}`);
      const raw = await readFile(candidate.path, { encoding: "utf8", signal: options?.signal });
      const directory = dirname(candidate.path);
      return { ...summary, content: skillBody(raw, candidate.path) + runtimeSection(skill, directory, node) };
    }
  };
  ctx.skills.registerProvider(() => provider);
  for (const skill of PLUGIN.skills) {
    const script = join2(packageRoot, "skills", skill.name, "scripts", "artifact.mjs");
    const watcher = skill.comments ? new CommentWatcher(ctx, skill, script, node) : null;
    if (watcher) ctx.effect(() => () => watcher.dispose(), `${PLUGIN.name}: comment waits`);
    ctx.on("tools/result", (exec, result) => {
      const opened = openedEditor(script, exec, result);
      if (opened === null) return;
      watcher?.watch(opened.session, opened.root);
      try {
        recordOpened(skill.name, PLUGIN.provider, opened.session, opened.root);
      } catch (error) {
        ctx.logger?.warn?.(`${PLUGIN.name}: could not note ${opened.root} for the Artifacts page: ${error.message}`);
      }
    });
    ctx.inject?.(["connection"], (sub) => {
      registerRoutes(sub.connection.fetch, { name: skill.name, plugin: PLUGIN.provider, script, node }, (record) => {
        watcher?.watch(record.sessionId, record.root);
      });
    });
  }
}
export {
  COMMENT_SOURCE,
  apply,
  commentMessage,
  inject,
  jsonObject,
  jsonObjects,
  name,
  openedEditor,
  resolveNode,
  runtimeSection
};
