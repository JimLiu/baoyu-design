#!/usr/bin/env node
// Writes the plugin index of this repository's DeepSeek Harness plugins: one JSON file in the plugin market index
// format DSH reads (format 1), so the app's Discover tab can list, install and flag updates of the plugins.
// Format: https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/guide/plugin-market.md
//
// The plugins are the packages in dsh-plugins/*/. Each is listed with every version on npm that declares a DSH bundle
// and is not deprecated, with npm's publish time and dist-tags (a package that npm does not have yet, or that has no
// such version, such as a placeholder, is left out). The title, description, icon, author, homepage, repository and
// keywords come from the npm tarball of the highest listed version. Node built-ins only; the result is checked with
// DSH's own validator, @deepseek-ai/dsh-plugin-market-index, which must be installed for that.
//
//   node .github/scripts/dsh-plugin-index.mjs --out _site/dsh-plugins/index.json
//   --out <file>       where to write the index (required)
//   --wait <version>   first wait, up to 10 minutes, until npm lists <version> of each plugin whose folder has it
//                      (right after a publish the registry can lag)
//   --url <url>        the address the index is served at, for the check (default: the GitHub Pages address)
//   --no-check         skip the validator
//   <name>…            only these packages, in this order
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REGISTRY = 'https://registry.npmjs.org/';
const INDEX_URL = 'https://jimliu.github.io/baoyu-design/dsh-plugins/index.json';
const TITLE = 'baoyu-design';
const DESCRIPTION = {
  en: "Claude's Artifact types as DeepSeek Harness plugins: slide decks, design canvases, design systems and dashboards, each opened in an editor that runs on your machine.",
  zh: '把 Claude 的 Artifact 类型做成 DeepSeek Harness 插件：幻灯片、设计画布、设计系统和数据看板，每个都在你电脑上运行的编辑器里打开。',
};
/** Icons up to this size are embedded as data: URLs; larger ones are written to icons/ beside the index. */
const INLINE_ICON_BYTES = 16 * 1024;
const MAX_ICON_BYTES = 256 * 1024;
const ICON_TYPES = { '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };
const LANGUAGE = /^[a-z]{2,8}(-[a-z0-9]{1,8})*$/;
const DIRECTORY = /^[A-Za-z0-9._@+-]+(\/[A-Za-z0-9._@+-]+)*$/;

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = process.argv.slice(2);
const option = (flag) => {
  const at = args.indexOf(flag);
  if (at < 0) return undefined;
  const value = args[at + 1];
  if (value === undefined || value.startsWith('--')) fail(`${flag} needs a value`);
  args.splice(at, 2);
  return value;
};
const out = option('--out');
const waitFor = option('--wait');
const indexUrl = option('--url') ?? INDEX_URL;
const check = !args.includes('--no-check');
const names = args.filter((a) => a !== '--no-check');
if (names.some((a) => a.startsWith('--'))) fail(`unknown option ${names.find((a) => a.startsWith('--'))}`);
if (!out) fail('--out <file> is required');

function fail(message) {
  console.error(`dsh-plugin-index: ${message}`);
  process.exit(1);
}

/** The packages in the folders of dsh-plugins/, by package name, with the version each folder holds. */
function localPlugins() {
  const dir = path.join(root, 'dsh-plugins');
  const found = fs.existsSync(dir)
    ? fs.readdirSync(dir).sort().flatMap((entry) => {
      const file = path.join(dir, entry, 'package.json');
      if (!fs.existsSync(file)) return [];
      const { name, version } = JSON.parse(fs.readFileSync(file, 'utf8'));
      return [{ name, version }];
    })
    : [];
  if (names.length === 0) {
    if (found.length === 0) fail(`no plugin in ${dir}`);
    return found;
  }
  return names.map((name) => found.find((p) => p.name === name) ?? { name, version: undefined });
}

async function packument(name, fresh) {
  const url = `${REGISTRY}${name.replace('/', '%2F')}${fresh ? `?t=${Date.now()}` : ''}`;
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.json();
}

/** SemVer precedence (build metadata ignored), for picking the highest version. */
function compareVersions(a, b) {
  const parse = (v) => {
    const plain = v.split('+')[0];
    const dash = plain.indexOf('-');
    const core = (dash < 0 ? plain : plain.slice(0, dash)).split('.').map(Number);
    return { core, pre: dash < 0 ? [] : plain.slice(dash + 1).split('.') };
  };
  const x = parse(a);
  const y = parse(b);
  for (let i = 0; i < 3; i++) if (x.core[i] !== y.core[i]) return x.core[i] - y.core[i];
  if (x.pre.length === 0 || y.pre.length === 0) return y.pre.length - x.pre.length;
  for (let i = 0; i < Math.max(x.pre.length, y.pre.length); i++) {
    const p = x.pre[i];
    const q = y.pre[i];
    if (p === undefined || q === undefined) return p === undefined ? -1 : 1;
    if (p === q) continue;
    const pn = /^\d+$/.test(p);
    const qn = /^\d+$/.test(q);
    if (pn && qn) return Number(p) - Number(q);
    if (pn !== qn) return pn ? -1 : 1;
    return p < q ? -1 : 1;
  }
  return 0;
}

const isBundle = (manifest) => {
  const patch = manifest?.dsh?.bundle?.patch;
  return (typeof patch === 'string' && patch !== '')
    || (Array.isArray(patch) && patch.length > 0 && patch.every((p) => typeof p === 'string' && p !== ''));
};

/** The versions DSH can install from npm, with the range of DSH releases each declares. */
function listedVersions(name, doc) {
  return Object.entries(doc.versions ?? {}).flatMap(([version, manifest]) => {
    const published = doc.time?.[version];
    if (manifest.private === true || (typeof manifest.deprecated === 'string' && manifest.deprecated !== '')) return [];
    if (!isBundle(manifest) || typeof published !== 'string') return [];
    const dsh = typeof manifest.engines?.dsh === 'string' ? manifest.engines.dsh.trim() : '';
    if (dsh === '') {
      console.warn(`${name}@${version}: no engines.dsh, not listed`);
      return [];
    }
    return [{ version, publishTimestamp: Math.floor(Date.parse(published) / 1000), source: { type: 'npm' }, engines: { dsh } }];
  });
}

/** Unpack one npm tarball, checked against the registry's integrity hash, into a temporary folder. */
async function unpack(name, version, dist) {
  const res = await fetch(dist.tarball);
  if (!res.ok) throw new Error(`${dist.tarball}: HTTP ${res.status}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  const sri = (dist.integrity ?? '').split(/\s+/).find((s) => s.startsWith('sha512-'));
  const ok = sri
    ? createHash('sha512').update(bytes).digest('base64') === sri.slice('sha512-'.length)
    : createHash('sha1').update(bytes).digest('hex') === dist.shasum;
  if (!ok) throw new Error(`${name}@${version}: the tarball does not match the registry's hash`);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-plugin-index-'));
  const file = path.join(dir, 'package.tgz');
  fs.writeFileSync(file, bytes);
  execFileSync('tar', ['-xzf', file, '-C', dir]);
  const top = fs.readdirSync(dir).find((entry) => entry !== 'package.tgz' && fs.statSync(path.join(dir, entry)).isDirectory());
  if (!top) throw new Error(`${name}@${version}: empty tarball`);
  return { dir, pkg: path.join(dir, top) };
}

/** LocalizedText from each locale file's meta[field], English required (falling back to the manifest's value). */
function localized(locales, field, fallback) {
  const text = {};
  for (const [lang, meta] of locales) {
    const value = meta?.[field];
    if (typeof value === 'string' && value.trim() !== '') text[lang] = value;
  }
  if (text.en === undefined) {
    if (typeof fallback !== 'string' || fallback.trim() === '') return undefined;
    text.en = fallback;
  }
  const keys = Object.keys(text);
  if (keys.length === 1) return text.en;
  return Object.fromEntries(['en', ...keys.filter((k) => k !== 'en').sort()].map((k) => [k, text[k]]));
}

function authorName(author) {
  const raw = typeof author === 'string' ? author.replace(/<[^>]*>/g, '').replace(/\([^)]*\)/g, '') : author?.name;
  return typeof raw === 'string' && raw.trim() !== '' ? raw.trim() : undefined;
}

/** The repository's web page: a git URL loses its git+ prefix, credentials, query, fragment and .git suffix. */
function repositoryOf(repository, label) {
  const raw = typeof repository === 'string' ? repository : repository?.url;
  if (typeof raw !== 'string') return undefined;
  let web;
  const short = /^(?:github:)?([\w.-]+)\/([\w.-]+)$/.exec(raw);
  if (short) web = `https://github.com/${short[1]}/${short[2]}`;
  else {
    try {
      const url = new URL(raw.replace(/^git\+/, ''));
      if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('not http(s)');
      url.username = '';
      url.password = '';
      url.search = '';
      url.hash = '';
      web = url.href.replace(/\.git$/, '').replace(/\/$/, '');
    } catch {
      console.warn(`${label}: repository ${raw} has no web page, left out`);
      return undefined;
    }
  }
  const dir = typeof repository === 'object' ? repository.directory : undefined;
  const usable = typeof dir === 'string' && DIRECTORY.test(dir) && !dir.split('/').some((s) => s === '.' || s === '..');
  return { url: web, ...(usable ? { directory: dir } : {}) };
}

/** What a Discover card shows, read from the package the way DSH reads an installed plugin. */
function display(pkg, name, version, icons) {
  const label = `${name}@${version}`;
  const manifest = JSON.parse(fs.readFileSync(path.join(pkg, 'package.json'), 'utf8'));
  if (manifest.name !== name || manifest.version !== version) throw new Error(`${label}: the tarball holds ${manifest.name}@${manifest.version}`);
  const localeDir = path.join(pkg, 'locale');
  const locales = fs.existsSync(path.join(localeDir, 'en.json'))
    ? fs.readdirSync(localeDir).sort().flatMap((file) => {
      const lang = file.replace(/\.json$/, '');
      if (!file.endsWith('.json') || !LANGUAGE.test(lang)) return [];
      try {
        return [[lang, JSON.parse(fs.readFileSync(path.join(localeDir, file), 'utf8')).meta]];
      } catch (error) {
        console.warn(`${label}: locale/${file} skipped: ${error.message}`);
        return [];
      }
    })
    : [];
  const fields = {
    title: localized(locales, 'title', manifest.name),
    description: localized(locales, 'description', manifest.description),
  };
  if (typeof manifest.icon === 'string') {
    const file = path.resolve(pkg, manifest.icon);
    const type = ICON_TYPES[path.extname(file).toLowerCase()];
    if (!file.startsWith(pkg + path.sep) || !fs.existsSync(file) || !type) console.warn(`${label}: icon ${manifest.icon} left out`);
    else {
      const bytes = fs.readFileSync(file);
      if (bytes.length > MAX_ICON_BYTES) console.warn(`${label}: icon over ${MAX_ICON_BYTES} bytes, left out`);
      else if (bytes.length <= INLINE_ICON_BYTES) fields.icon = `data:${type};base64,${bytes.toString('base64')}`;
      else {
        const rel = `icons/${name.replace('/', '__')}${path.extname(file).toLowerCase()}`;
        icons.push({ rel, bytes });
        fields.icon = rel;
      }
    }
  }
  const author = authorName(manifest.author);
  if (author) fields.author = author;
  if (typeof manifest.homepage === 'string' && /^https?:\/\//.test(manifest.homepage)) fields.homepage = manifest.homepage;
  const repository = repositoryOf(manifest.repository, label);
  if (repository) fields.repository = repository;
  if (Array.isArray(manifest.keywords) && manifest.keywords.every((k) => typeof k === 'string')) {
    fields.metadata = { keywords: manifest.keywords };
  }
  return fields;
}

async function waitForVersion(plugins, version) {
  const due = plugins.filter((p) => p.version === version);
  if (due.length === 0) fail(`--wait ${version}: no plugin folder holds that version`);
  const deadline = Date.now() + 10 * 60 * 1000;
  for (const { name } of due) {
    for (;;) {
      const doc = await packument(name, true);
      if (doc?.versions?.[version] && doc.time?.[version]) break;
      if (Date.now() > deadline) fail(`${name}@${version} is still not on npm after 10 minutes`);
      console.log(`${name}@${version} is not on npm yet, waiting`);
      await new Promise((resolve) => setTimeout(resolve, 15000));
    }
  }
}

const plugins = localPlugins();
if (waitFor) await waitForVersion(plugins, waitFor);

const icons = [];
const entries = [];
for (const { name } of plugins) {
  const doc = await packument(name, Boolean(waitFor));
  if (doc === null) {
    console.log(`${name}: not on npm, not listed`);
    continue;
  }
  const versions = listedVersions(name, doc).sort((a, b) => compareVersions(b.version, a.version));
  if (versions.length === 0) {
    console.log(`${name}: no version on npm declares a DSH bundle, not listed`);
    continue;
  }
  const highest = versions[0].version;
  const { dir, pkg } = await unpack(name, highest, doc.versions[highest].dist);
  let fields;
  try {
    fields = display(pkg, name, highest, icons);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  const listed = new Set(versions.map((v) => v.version));
  const tags = Object.fromEntries(Object.entries(doc['dist-tags'] ?? {}).filter(([, v]) => listed.has(v)));
  entries.push({ name, ...fields, ...(Object.keys(tags).length > 0 ? { 'dist-tags': tags } : {}), versions });
  const tagNote = Object.entries(tags).map(([tag, v]) => `${tag} ${v}`).join(', ');
  console.log(`${name}: ${versions.map((v) => v.version).join(', ')}${tagNote ? ` (${tagNote})` : ''}`);
}

const index = { format: 1, title: TITLE, description: DESCRIPTION, plugins: entries };
const text = `${JSON.stringify(index, null, 2)}\n`;

if (check) {
  let validator;
  try {
    validator = await import('@deepseek-ai/dsh-plugin-market-index');
  } catch {
    fail('install @deepseek-ai/dsh-plugin-market-index to check the index, or pass --no-check');
  }
  const parsed = validator.parseMarketIndex(JSON.parse(text), indexUrl);
  for (const plugin of parsed.plugins) {
    for (const version of plugin.versions) {
      const { spec } = validator.marketInstallTarget(plugin.name, version);
      if (spec !== `${plugin.name}@${version.version}`) fail(`${plugin.name}: installs ${spec}, not ${plugin.name}@${version.version}`);
    }
  }
  console.log(`checked with @deepseek-ai/dsh-plugin-market-index against ${indexUrl}`);
}

const outFile = path.resolve(out);
fs.mkdirSync(path.dirname(outFile), { recursive: true });
for (const icon of icons) {
  const file = path.join(path.dirname(outFile), icon.rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, icon.bytes);
}
fs.writeFileSync(outFile, text);
console.log(`${entries.length} plugins → ${outFile}`);
