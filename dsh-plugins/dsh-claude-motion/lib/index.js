// dsh-claude-motion 2.11.0: built from baoyu-design.
var define_PLUGIN_default = { name: "claude-motion", provider: "dsh-claude-motion", skills: [{ name: "claude-motion", description: "Use this for a local Motion film: a short animated video (10–30 s unless asked for more, 900 s at most), such as an explainer, product walkthrough or UI demo, launch teaser, logo sting, social clip, animated chart or title sequence, that plays in the bundled Motion player and exports from there to MP4 or GIF. A narrated one carries a voice track: a take a scene, made here with a speech provider of the user's or recorded by them, spoken and captioned by the player, the motion timed to its words. Everything on screen is code, a pure function of time, written scene by scene into the film's own store with this skill's script while the user watches it fill in. Read it when creating, continuing, finalizing or revising one. Not for editing real footage, subtitles or audio (that is a video editor), a still picture, a slide deck or a static HTML page.", scriptAlias: "A", comments: true, requests: true }] };

import { readFile } from "node:fs/promises";
import { dirname as dirname2, join as join2, posix, sep, win32 } from "node:path";
import { fileURLToPath } from "node:url";

var HOST = Symbol.for("baoyu-design/dsh-artifacts-host");
function hostHub() {
  const g = globalThis;
  return g[HOST] ??= { members: [] };
}
function hostRunning() {
  return hostHub().members.length > 0;
}

import { statSync } from "node:fs";
import { delimiter, dirname, isAbsolute, join } from "node:path";
function isFile(path) {
  try {
    return statSync(path).isFile();
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

var PLUGIN = define_PLUGIN_default;
var name = PLUGIN.name;
var inject = ["skills"];
var BUNDLED_SKILL_RANK = 600;
var packageRoot = fileURLToPath(new URL("../", import.meta.url));
function shellQuote(path) {
  return `"${path.replace(/(["\\$`])/g, "\\$1")}"`;
}
function powerShellQuote(path) {
  return `'${path.replace(/['\u2018-\u201b]/g, "$&$&")}'`;
}
function scriptCommand(node, script, args, platform) {
  if (platform !== "win32") return [node.env, shellQuote(node.path), shellQuote(script), ...args].filter(Boolean).join(" ");
  const [name2, value] = node.env?.split("=") ?? [];
  const env = name2 ? `$env:${name2} = ${powerShellQuote(value ?? "")};` : "";
  return [env, "&", powerShellQuote(node.path), powerShellQuote(script), ...args].filter(Boolean).join(" ");
}
function runtimeSection(skill, skillDir, node, platform = process.platform, watched = true) {
  const windows = platform === "win32";
  const script = (windows ? win32 : posix).join(skillDir, "scripts", "artifact.mjs");
  const written = skill.scriptAlias === void 0 ? "`node <this skill's folder>/scripts/artifact.mjs <command>`" : `\`node $${skill.scriptAlias} <command>\` (\`${skill.scriptAlias}\` being \`<this skill's folder>/scripts/artifact.mjs\`)`;
  const lines = [
    "",
    "",
    "## Running the calls in DeepSeek Harness",
    "",
    "Wherever these pages, or the script's own output (its `stop`, `next` and other hints), say",
    `${written}, run this in the shell instead, with the ${windows ? "`&` and the " : ""}quotes (the paths can contain spaces):`,
    "",
    windows ? "```powershell" : "```sh",
    scriptCommand(node, script, ["<command> …"], platform),
    "```",
    "",
    ...windows ? [
      "The shell here is PowerShell. PowerShell has no heredoc (`<<'EOF'`): where a page offers one, write the text to",
      "a file and pass its path.",
      ""
    ] : [],
    "`open` prints the editor's `url` (on 127.0.0.1): give it to the user as a Markdown link. In the DeepSeek Harness",
    "app a chat link opens in the right sidebar's Browser, next to this conversation."
  ];
  if (skill.comments && watched) {
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
function skillBody(raw, path) {
  const frontmatter = /^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/u.exec(raw);
  if (frontmatter === null) throw new Error(`${PLUGIN.name}: ${path} has no YAML frontmatter`);
  return raw.slice(frontmatter[0].length).trim();
}
function apply(ctx, config = {}) {
  const node = resolveNode(PLUGIN.name, config ?? {});
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
      const directory = dirname2(candidate.path);
      return { ...summary, content: skillBody(raw, candidate.path) + runtimeSection(skill, directory, node, process.platform, hostRunning()) };
    }
  };
  ctx.skills.registerProvider(() => provider);
}
export {
  apply,
  inject,
  name,
  runtimeSection
};
