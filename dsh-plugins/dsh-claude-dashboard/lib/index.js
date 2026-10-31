// dsh-claude-dashboard 2.4.0: built from baoyu-design.
var define_PLUGIN_default = { name: "claude-dashboard", provider: "dsh-claude-dashboard", skills: [{ name: "claude-dashboard", description: "Use this for a local, data-backed dashboard, metrics page, KPI tracker, scorecard, data visualization or recurring report that opens in the bundled live editor: a page or scroll story of charts, numbers and tables over datasets (a CSV/TSV/JSON file the user has, or data you gather and attach), with a Sources panel that shows where every number comes from. Read it when creating, filling, refreshing or revising one. You write the datasets, then the page as plain HTML, into the dashboard's own store with this skill's script. Not for a static HTML mockup or a picture of a dashboard: that is the baoyu-design skill.", scriptAlias: "A", comments: true }] };
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { delimiter, dirname, isAbsolute, join, sep } from "node:path";
import { fileURLToPath } from "node:url";
const PLUGIN = define_PLUGIN_default;
const name = PLUGIN.name;
const inject = ["skills"];
const BUNDLED_SKILL_RANK = 600;
const packageRoot = fileURLToPath(new URL("../", import.meta.url));
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
    roots.push(join(dir, "Resources"), join(dir, "resources"));
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  for (const root of roots) {
    const candidate = join(root, ...runtime);
    if (isFile(candidate)) return { path: candidate, from: "desktop runtime" };
  }
  for (const entry of (process.env.PATH ?? "").split(delimiter)) {
    if (entry === "" || !isAbsolute(entry)) continue;
    const candidate = join(entry, exe);
    if (isFile(candidate)) return { path: candidate, from: "PATH" };
  }
  return { path: process.execPath, env: "ELECTRON_RUN_AS_NODE=1", from: "electron" };
}
function shellQuote(path) {
  return `"${path.replace(/(["\\$`])/g, "\\$1")}"`;
}
function runtimeSection(skill, skillDir, node) {
  const script = join(skillDir, "scripts", "artifact.mjs");
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
    const sent = skill.commentsBy === "mention" ? "A comment, reply or edit in the viewer that says `@agent` is sent to you (the viewer has no Send to agent box)." : "The editor shows **Send to agent** on a comment while comments can reach you; a comment sent with it is sent to you.";
    lines.push(
      "",
      "### Comments sent to you from the editor",
      "",
      sent,
      "Here DeepSeek Harness waits for them for you: after you run `open` it runs `comments <root> --wait` itself, and",
      "each comment sent to you arrives in this conversation as a message with the threads (it wakes you when you are",
      "idle). Handle it as Comments says",
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
const COMMENT_SOURCE = "baoyu-design-comment";
const SUMMARY_MAX = 120;
const SESSION_CHECK_MS = 6e4;
const RETRY_MS = 5e3;
const MAX_QUICK_FAILURES = 3;
const regexpEscape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
const bound = (text) => text.length <= SUMMARY_MAX ? text : `${text.slice(0, SUMMARY_MAX - 1)}…`;
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
class CommentWatcher {
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
  /** The agent ran this skill's `open`: see whether its output names an editor, and wait for its comments. */
  observe(exec, result) {
    if (exec.name !== "bash" || exec.agent === void 0 || result.isError) return;
    const args = exec.arguments;
    const command = args?.command;
    if (typeof command !== "string" || args?.run_in_background === true) return;
    if (!new RegExp(`${regexpEscape(this.script)}["']?\\s+open(?:\\s|$)`).test(command)) return;
    const stdout = bashStdout(result);
    const opened = stdout === null ? null : jsonObject(stdout);
    if (typeof opened?.root !== "string" || typeof opened.url !== "string") return;
    this.watch(String(exec.agent.id), opened.root);
  }
  watch(session, root) {
    const key = `${session}\0${root}`;
    if (this.watches.has(key)) return;
    const watch = { child: null, stopped: false, quickFailures: 0 };
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
    if (watch.stopped) return;
    if (this.agent(session) === void 0) return this.stop(key, watch, "the session is gone");
    const env = { ...process.env };
    if (this.node.env) {
      const [name2, value] = this.node.env.split("=");
      if (name2) env[name2] = value ?? "";
    }
    const started = Date.now();
    const child = spawn(this.node.path, [this.script, "comments", root, "--wait"], { env, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
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
        if (out && (came(out.threads) || came(out.requests))) this.deliver(session, out, root);
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
      if (this.agent(session) === void 0) this.stop(key, watch, "the session is gone");
    }
  }
  dispose() {
    clearInterval(this.check);
    for (const [key, watch] of [...this.watches]) this.stop(key, watch, "the plugin stopped");
  }
}
function skillBody(raw, path) {
  const frontmatter = /^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/u.exec(raw);
  if (frontmatter === null) throw new Error(`${PLUGIN.name}: ${path} has no YAML frontmatter`);
  return raw.slice(frontmatter[0].length).trim();
}
function apply(ctx, config = {}) {
  const node = resolveNode(config ?? {});
  const skills = new Map(PLUGIN.skills.map((skill) => [skill.name, skill]));
  const candidates = PLUGIN.skills.map(({ name: skillName, description }) => {
    const directory = join(packageRoot, "skills", skillName);
    const path = join(directory, "SKILL.md");
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
    if (!skill.comments) continue;
    const script = join(packageRoot, "skills", skill.name, "scripts", "artifact.mjs");
    const watcher = new CommentWatcher(ctx, skill, script, node);
    ctx.on("tools/result", (exec, result) => watcher.observe(exec, result));
    ctx.effect(() => () => watcher.dispose(), `${PLUGIN.name}: comment waits`);
  }
}
export {
  COMMENT_SOURCE,
  apply,
  commentMessage,
  inject,
  jsonObject,
  name,
  resolveNode,
  runtimeSection
};
