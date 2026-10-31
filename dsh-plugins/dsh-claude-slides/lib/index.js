// dsh-claude-slides 2.3.0: built from baoyu-design.
var define_PLUGIN_default = { name: "claude-slides", provider: "dsh-claude-slides", skills: [{ name: "claude-slides", description: "Make and revise slide decks in the Slides artifact format (project/deck.json plus one HTML file per slide) as local files, then open them in a local slide editor where the user can present, retype, drag, and export PDF, HTML or PowerPoint. Use when the user asks for an editable slide deck or presentation in this format, names claude-slides or the Slides type, or wants to revise a folder that holds project/deck.json. A one-off single-file HTML deck or prototype is baoyu-design's.", comments: true }] };
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
    const why = skill.commentsBy === "mention" ? [
      "A comment, reply or edit in the viewer that says `@agent` is sent to you, and only this wait hands it to you",
      "(the viewer has no Send to agent box; one sent while nothing waits comes back from the next wait at once). So",
      "each time you give the user the viewer's link, also start this wait with the bash tool's"
    ] : [
      "The editor shows **Send to agent** on a comment only while you wait for one. So each time you give the user the",
      "editor's link, also start this wait with the bash tool's"
    ];
    lines.push(
      "",
      "### Comments sent to you from the editor",
      "",
      ...why,
      '`run_in_background: true` (that is the "background command that tells you when it exits"; one per `<root>`: skip',
      "it when `job_list` already shows one running for that folder):",
      "",
      "```sh",
      run("comments", '"<root>"', "--wait"),
      "```",
      "",
      "It runs, with no timeout, until the person sends a comment, then exits, and its completion notice wakes you. Then:",
      "read the threads with `job_output`, handle them as Comments says",
      skill.commentsBy === "mention" ? "(read the block, change the doc with `update`, then `comment-reply`), and" : "(change the files, then `comment-reply`), and",
      "start the same wait again in the background. If the wait ends with `NO_SERVER`, the editor was stopped: leave it",
      "stopped. Never run the wait in the foreground, and do not poll `job_output` while it runs.",
      ...skill.commentsBy === "mention" ? ["", "When you first give the link, tell the user that a comment with `@agent` in it reaches you (type `@` and pick agent)."] : []
    );
  }
  return lines.join("\n");
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
}
export {
  apply,
  inject,
  name,
  resolveNode,
  runtimeSection
};
