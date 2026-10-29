#!/usr/bin/env node
/**
 * Builds the local Artifact tool for claude-slides, claude-design and claude-design-system from BaoCut.
 *
 *   node tools/artifact-skills/build.mjs [--editors] [--only slides|design|design-system]
 *
 * For each skill it writes
 *   skills/<skill>/scripts/artifact.mjs        cli.ts bundled with @baocut/slides, @baocut/design, @baocut/design-system
 *                                              (the checks; open/serve start the skill's own server.mjs)
 *   skills/<skill>/scripts/editor/             the editor page (BaoCut apps/<x>-editor/dist)
 *   skills/<skill>/artifact-type/reference/    the type's references, copied verbatim from the originals
 *                                              (design system: also artifact-type/demo.json)
 *
 * BAOCUT_DIR (default ../baocut) is the BaoCut checkout; ORIGINALS_DIR (default ../claude-skills/originals) holds the
 * original artifact types. --editors rebuilds the editor dists in BaoCut first (their build scripts skip when up to date).
 * SKILL.md and scripts/server.mjs (the editor server: plain Node, one per skill) are hand-written and never touched here;
 * the build stops when a server.mjs is missing and warns when the three servers' shared core differs.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../..');
const baocut = path.resolve(process.env.BAOCUT_DIR ?? path.join(repo, '../baocut'));
const originals = path.resolve(process.env.ORIGINALS_DIR ?? path.join(repo, '../claude-skills/originals'));

const SKILLS = [
  { key: 'slides', skill: 'claude-slides', kind: 'slides', editor: 'slides-editor', original: 'slides-type' },
  { key: 'design', skill: 'claude-design', kind: 'design', editor: 'design-editor', original: 'design-type' },
  {
    key: 'design-system',
    skill: 'claude-design-system',
    kind: 'design-system',
    editor: 'design-system-editor',
    original: 'design-system-type',
    extras: ['artifact-type/demo.json'],
    editorPatches: [['design_import_asset', 'artifact.mjs upload']],
  },
];

const args = process.argv.slice(2);
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
const rebuildEditors = args.includes('--editors');

for (const dir of [baocut, originals]) {
  if (!fs.existsSync(dir)) {
    console.error(`Missing ${dir}; set BAOCUT_DIR / ORIGINALS_DIR.`);
    process.exit(1);
  }
}

const esbuild = createRequire(path.join(baocut, 'package.json'))('esbuild');

function copyDir(from, to) {
  fs.rmSync(to, { recursive: true, force: true });
  fs.cpSync(from, to, { recursive: true, filter: src => !path.basename(src).startsWith('.') });
}

function sizeOf(dir) {
  let total = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true, recursive: true })) {
    if (entry.isFile()) total += fs.statSync(path.join(entry.parentPath, entry.name)).size;
  }
  return total;
}

const mb = n => `${(n / 1024 / 1024).toFixed(1)} MB`;

// The three servers share everything below this line; only the section above it (the artifact's files) differs.
const CORE_MARKER = '// ==================== shared core';
const cores = new Map();
for (const s of SKILLS) {
  const file = path.join(repo, 'skills', s.skill, 'scripts', 'server.mjs');
  if (!fs.existsSync(file)) {
    console.error(`[${s.skill}] scripts/server.mjs is missing; it is hand-written, not generated.`);
    process.exit(1);
  }
  const text = fs.readFileSync(file, 'utf8');
  const at = text.indexOf(CORE_MARKER);
  if (at >= 0) cores.set(s.skill, text.slice(at));
}
if (new Set(cores.values()).size > 1) {
  console.warn(`The shared core of scripts/server.mjs differs between ${[...cores.keys()].join(', ')}; make the same change in all three.`);
}

for (const s of SKILLS) {
  if (only && only !== s.key && only !== s.skill) continue;
  const skillDir = path.join(repo, 'skills', s.skill);
  const scripts = path.join(skillDir, 'scripts');
  fs.mkdirSync(scripts, { recursive: true });

  if (rebuildEditors) {
    console.log(`[${s.skill}] building BaoCut apps/${s.editor}`);
    execFileSync(process.execPath, [path.join(baocut, 'apps', s.editor, 'build.mjs')], { cwd: baocut, stdio: 'inherit' });
  }
  const dist = path.join(baocut, 'apps', s.editor, 'dist');
  if (!fs.existsSync(path.join(dist, 'index.html'))) {
    console.error(`[${s.skill}] ${dist} is not built; run with --editors.`);
    process.exit(1);
  }
  if (s.kind === 'slides' && !fs.existsSync(path.join(dist, 'node', 'compiler.cjs'))) {
    console.error(`[${s.skill}] ${dist}/node/compiler.cjs is missing; rebuild with --editors.`);
    process.exit(1);
  }

  await esbuild.build({
    entryPoints: [path.join(here, 'cli.ts')],
    outfile: path.join(scripts, 'artifact.mjs'),
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node20',
    nodePaths: [path.join(baocut, 'node_modules')],
    define: { __KIND__: JSON.stringify(s.kind), __SKILL__: JSON.stringify(s.skill) },
    banner: {
      js: `#!/usr/bin/env node\n// ${s.skill}: local Artifact tool. Generated by tools/artifact-skills/build.mjs from BaoCut; do not edit.`,
    },
    legalComments: 'none',
    logLevel: 'warning',
  });

  copyDir(dist, path.join(scripts, 'editor'));
  for (const [from, to] of s.editorPatches ?? []) {
    // The page writes these words into the cards it generates (api/…); name this skill's command instead of BaoCut's tool.
    const assets = path.join(scripts, 'editor', 'assets');
    let hits = 0;
    for (const name of fs.readdirSync(assets).filter(n => n.endsWith('.js'))) {
      const file = path.join(assets, name);
      const text = fs.readFileSync(file, 'utf8');
      const patched = text.split(from).join(to);
      if (patched !== text) {
        hits += text.split(from).length - 1;
        fs.writeFileSync(file, patched);
      }
    }
    if (hits === 0) console.warn(`[${s.skill}] editor patch found no "${from}"; check the generated cards by hand.`);
  }

  const reference = path.join(originals, s.original, 'artifact-type', 'reference');
  copyDir(reference, path.join(skillDir, 'artifact-type', 'reference'));
  for (const extra of s.extras ?? []) fs.copyFileSync(path.join(originals, s.original, extra), path.join(skillDir, extra));

  console.log(
    `[${s.skill}] scripts/artifact.mjs ${mb(fs.statSync(path.join(scripts, 'artifact.mjs')).size)}, ` +
      `scripts/editor ${mb(sizeOf(path.join(scripts, 'editor')))}, artifact-type/reference ${fs.readdirSync(reference).length} files`,
  );
}
