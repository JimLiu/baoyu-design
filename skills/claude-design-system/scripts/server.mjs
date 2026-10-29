#!/usr/bin/env node
/**
 * claude-design-system: the local editor server for one design system. Plain Node (22+), built-ins only.
 *
 *   node scripts/server.mjs <root> [--port n] [--host h]
 *
 * Normally started by `artifact.mjs open` (in the background) or `artifact.mjs serve` (in the foreground). It serves
 * the prebuilt editor page (scripts/editor/) and the design system's files under <root>/project/, takes the page's saves and
 * uploads, and watches the folder, so that edits made in the page land on disk and edits made on disk (an agent, an
 * editor, git) reach the page:
 *
 *   /design-system/<grant>/                   the editor page (scripts/editor/index.html and its assets)
 *   /design-system/<grant>/artifact-type/run.html   the component-preview frame (same CSP as the page)
 *   /design-system/<grant>/_files.json        listing {ver, files: {"project/<path>": {sha256, size, contentType}}}
 *   /design-system/<grant>/project/<path>     a design system file
 *   /design-system/<grant>/__deck/publish     POST {files: {path: {base64, contentType, ifMatch?} | {delete: true} | null}}
 *   /design-system/<grant>/__deck/assets      POST raw bytes → {id, url: "/_blob/<id>", sizeBytes}
 *   /design-system/<grant>/__deck/events      SSE: "external-change" when a file changed on disk outside the page
 *   /design-system/<grant>/__deck/session     {canEdit: true, userName}
 *   /_blob/<id>, /design-system/<grant>/_blob/<id>   an upload (project/_blobs/<id>.<ext>)
 *
 * Saves are serialized; every file is written atomically (a dot-named temp file, then rename). The page's own saves
 * are remembered by content hash so they never come back to it as external changes. The folder is watched with one
 * fs.watch per directory plus a 2-second stat poll as a fallback; a change is debounced 300 ms, then compared by
 * content hash with what the page already has. The state file <root>/.artifact-server.json {pid, url, port, root,
 * kind, startedAt} lets `artifact.mjs open` reuse a running server and `artifact.mjs stop` end it.
 *
 * The three servers (claude-slides, claude-design, claude-design-system) differ only in the first section below,
 * which says what the artifact's files are; the rest is the same code in all three. Change it in all three.
 */
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// ==================== claude-design-system: what the artifact's files are ====================

const KIND = 'design-system';
const NOUN = 'design system';
const INDEX_FILE = 'design-system.json';
/** Uploads (assets/<group>/ is content in this format, so they live elsewhere). */
const BLOBS_DIR = '_blobs';

/**
 * The format's path rules (the original type's isValidDesignSystemPath, explainToolConfigurationPath,
 * explainReservedSystemPath and validateFilePath), so the editor can't save what `artifact.mjs check` rejects.
 */
const MAX_PATH_LENGTH = 300;
const MAX_RUNTIME_PATH_UTF8_BYTES = 512;
const UNSAFE_PATH_CHARACTER = /[\u0000-\u001f\u007f-\u009f\u200b\u200e\u200f\u202a-\u202e\u2028\u2029\u2060-\u206f\u2215\u2044\ufeff\uff0f]/;
const RUNTIME_PATH_RESERVED_CHARACTERS = /[%;:\\]/;
const INVISIBLE_PATH_CHARACTERS = /[\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/g;
const RESERVED_PROTOTYPE_NAMES = new Set(['__proto__', 'constructor', 'prototype']);
const REFUSED_TOOL_DIRECTORIES = new Set(['node_modules']);
const REFUSED_TOOL_FILENAMES = new Set([
  'package.json',
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'bun.lock',
  'bun.lockb',
  'bunfig.toml',
  'tsconfig.json',
  'jsconfig.json',
  'deno.json',
  'deno.jsonc',
  'claude.md',
  'claude.local.md',
  'agents.md',
]);
const WINDOWS_SHORT_NAME = /~\d/;
const IMAGE_SLOT_STATE_FILENAME = '.image-slots.state.json';

/** A segment as the format compares names: no invisible characters or text after ":", NFC, lower case, no trailing dots or spaces. */
function comparableSegment(segment) {
  let normalized = segment.replace(INVISIBLE_PATH_CHARACTERS, '');
  const colon = normalized.indexOf(':');
  if (colon >= 0) normalized = normalized.slice(0, colon);
  return normalized.normalize('NFC').toUpperCase().toLowerCase().replace(/[. ]+$/, '');
}

const comparablePath = rel => rel.split('/').map(comparableSegment).join('/');

function isImageSlotStatePath(rel) {
  const parts = rel.split('/');
  return parts[parts.length - 1] === IMAGE_SLOT_STATE_FILENAME && !parts.slice(0, -1).some(p => comparableSegment(p).startsWith('.'));
}

function explainToolConfigurationPath(rel) {
  const parts = rel.split('/').map(comparableSegment);
  if (parts.some(p => p.startsWith('.')) && !isImageSlotStatePath(rel)) {
    return 'is a dot-file or dot-directory (tool, editor, VCS or agent configuration); never part of a design system';
  }
  if (REFUSED_TOOL_FILENAMES.has(parts[parts.length - 1] ?? '') || parts.some(p => REFUSED_TOOL_DIRECTORIES.has(p))) {
    return 'is a package-manager, toolchain or agent-instruction file that tools auto-load from a working directory; never part of a design system';
  }
  if (parts.some(p => WINDOWS_SHORT_NAME.test(p))) {
    return 'has a path segment shaped like a Windows 8.3 short name (NAME~1); rename it without the "~digit"';
  }
  return null;
}

function explainReservedSystemPath(rel) {
  const normalized = comparablePath(rel);
  const under = name => normalized === name || normalized.startsWith(`${name}/`);
  if (under(INDEX_FILE)) return `is reserved: ${INDEX_FILE} is the index; rename the file`;
  if (under('index.html')) return 'is reserved: index.html is the page itself in the original format; rename the file';
  if (under('skill.md') || under('artifact-type')) {
    return 'is reserved: SKILL.md and artifact-type/ are the design system type’s own files in the original format; rename the file';
  }
  return null;
}

/** Why a path (relative to project/) breaks the format's rules, or null when it doesn't. */
function explainDesignSystemPath(rel) {
  if (rel.length === 0 || rel.length > MAX_PATH_LENGTH || Buffer.byteLength(`project/${rel}`, 'utf8') > MAX_RUNTIME_PATH_UTF8_BYTES) {
    return `is empty or longer than ${MAX_PATH_LENGTH} characters; rename it`;
  }
  if (rel.startsWith('/') || UNSAFE_PATH_CHARACTER.test(rel) || RUNTIME_PATH_RESERVED_CHARACTERS.test(rel)) {
    return 'has a character a design system path cannot hold (a control or invisible character, a look-alike slash, % ; : or \\); rename it';
  }
  if (rel.endsWith('.cmekshadow')) return 'ends in .cmekshadow, which is reserved; rename it';
  for (const part of rel.split('/')) {
    if (part === '' || part === '.' || part === '..') return 'has an empty path segment or one that is only dots; rename it';
    if (RESERVED_PROTOTYPE_NAMES.has(part)) return `uses "${part}" as a path segment, which is reserved; rename it`;
  }
  return explainToolConfigurationPath(rel) ?? explainReservedSystemPath(rel);
}

const isBlobsPath = rel => rel === BLOBS_DIR || rel.startsWith(`${BLOBS_DIR}/`);

/** Files the editor sees and may write (path relative to project/): the index, and every file outside _blobs/ that keeps the rules. */
function isArtifactFile(rel) {
  if (rel === INDEX_FILE) return true;
  return !isBlobsPath(rel) && explainDesignSystemPath(rel) === null;
}

const descendInto = rel => !isBlobsPath(rel) && explainDesignSystemPath(rel) === null;

const LAYOUT = {
  /** Uploads: project/_blobs/<id>.<ext> plus the type index project/_blobs/index.json. */
  blobDir: BLOBS_DIR,
  isFile: isArtifactFile,
  /** Where listing and watching start; `descend` walks subdirectories. */
  roots: [{ rel: '', descend: true }],
  descendInto,
  /** Whether a change reported for this path can matter: a listed file, or a directory that may hold one. */
  watches: rel => isArtifactFile(rel) || descendInto(rel),
  /** The format's limits: 1,024 files, 15 MiB a file, 16 MiB a save; an upload 20 MiB, an SVG 2 MiB. */
  maxFiles: 1024,
  maxPublishBytes: 16 * 1024 * 1024,
  maxFileBytes: 15 * 1024 * 1024,
  maxBlobBytes: contentType => (contentType.split(';')[0].trim().toLowerCase() === 'image/svg+xml' ? 2 : 20) * 1024 * 1024,
  readOnlyMessage: p => {
    const rel = p.startsWith('project/') ? p.slice('project/'.length) : p;
    if (isBlobsPath(rel)) return `${p}: ${BLOBS_DIR}/ holds uploads and can't be written; upload the file instead`;
    return `${p}: ${explainDesignSystemPath(rel) ?? 'is not a design system file'}`;
  },
};

/** The editor page's (and artifact-type/run.html's) script-src: previews run the bundle and preview.html scripts. */
const pageScriptSrc = () => "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:";

/** Extra fields of __deck/session: the local user's name (the editor writes it into lastChange.by). */
function sessionExtras() {
  try {
    const name = os.userInfo().username.trim();
    return name ? { userName: name } : {};
  } catch {
    return {};
  }
}

// ==================== shared core (the same in all three servers) ====================

const SCRIPT = fileURLToPath(import.meta.url);
const EDITOR_DIR = path.join(path.dirname(SCRIPT), 'editor');
const STATE_FILE = '.artifact-server.json';

/** Content-Type by extension (listing and project/*). project/* is sent with nosniff, so scripts and styles need theirs. */
const MIME = {
  html: 'text/html',
  htm: 'text/html',
  json: 'application/json',
  css: 'text/css',
  js: 'text/javascript',
  mjs: 'text/javascript',
  md: 'text/markdown',
  txt: 'text/plain',
  xml: 'application/xml',
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  ico: 'image/x-icon',
  woff2: 'font/woff2',
  woff: 'font/woff',
  ttf: 'font/ttf',
  otf: 'font/otf',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  pdf: 'application/pdf',
  wasm: 'application/wasm',
};

/** An upload's file extension by its Content-Type; unknown types are stored as .bin. */
const EXT_BY_MIME = {
  'image/svg+xml': 'svg',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'font/woff2': 'woff2',
  'font/woff': 'woff',
  'font/ttf': 'ttf',
  'font/otf': 'otf',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
  'image/x-icon': 'ico',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'application/pdf': 'pdf',
};

/** The editor's own files. */
const STATIC_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.wasm': 'application/wasm',
  '.map': 'application/json; charset=utf-8',
};

const ROUTES = {
  listing: '_files.json',
  publish: '__deck/publish',
  assets: '__deck/assets',
  events: '__deck/events',
  session: '__deck/session',
};

const ASSET_INDEX = 'index.json';
const BLOB_ID = /^[0-9a-f]{32}$/;
const BLOB_PATH = /^_blob\/([0-9a-f]{32})$/;
/** Artifact files and uploads are data, never a page of their own (an SVG opened directly runs nothing). */
const DATA_CSP = "sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data:";
/** Body limits: a publish is the whole batch in base64; an upload may be a video. */
const MAX_PUBLISH_BYTES = 64 * 1024 * 1024;
const MAX_ASSET_BYTES = 256 * 1024 * 1024;
const SSE_KEEPALIVE_MS = 25_000;
const WATCH_DEBOUNCE_MS = 300;
const POLL_MS = 2000;
/** External changes kept for a page whose event stream reconnects (it sends the last id it saw). */
const CHANGE_LOG_SIZE = 64;

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

function contentTypeOf(file) {
  const ext = file.slice(file.lastIndexOf('.') + 1).toLowerCase();
  return MIME[ext] ?? 'application/octet-stream';
}

const assetExtensionOf = contentType => EXT_BY_MIME[contentType.split(';')[0].trim().toLowerCase()] ?? 'bin';

function isProjectPath(p) {
  if (typeof p !== 'string' || !p.startsWith('project/') || p.includes('\\') || p.includes('\0')) return false;
  return p.split('/').every(part => part !== '' && part !== '.' && part !== '..');
}

/** A publish entry that writes (not a delete: `{delete: true}` or null). */
const isWriteEntry = entry => entry !== null && !('delete' in entry);

function isWireEntry(value) {
  if (value === null) return true;
  if (typeof value !== 'object' || Array.isArray(value)) return false;
  if (value.delete === true) return value.ifMatch === undefined || typeof value.ifMatch === 'string';
  // A write's ifMatch may be null: the file must not exist yet.
  if (value.ifMatch !== undefined && value.ifMatch !== null && typeof value.ifMatch !== 'string') return false;
  return typeof value.base64 === 'string' && typeof value.contentType === 'string';
}

/** sha256 of each inline <script> in a page (for a CSP that names them). */
function inlineScriptHashes(html) {
  const hashes = [];
  for (const match of html.matchAll(/<script(\s[^>]*)?>([\s\S]*?)<\/script>/gi)) {
    if (/\ssrc\s*=/i.test(match[1] ?? '')) continue;
    hashes.push('sha256-' + createHash('sha256').update(match[2], 'utf8').digest('base64'));
  }
  return hashes;
}

/** The editor page's CSP: its scripts, Google Fonts, uploads and data:/blob: images, blob: workers and frames. */
function pageCsp(scriptSrc) {
  const fonts = 'https://fonts.googleapis.com https://fonts.gstatic.com';
  return [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob:",
    "media-src 'self' blob:",
    "worker-src 'self' blob:",
    `connect-src 'self' ${fonts}`,
    "frame-src 'self' blob: data:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'none'",
  ].join('; ');
}

/** The version of a listing: a hash of its paths and contents, so the same files give the same version. */
function versionOf(files) {
  const digest = sha256(
    Object.entries(files)
      .map(([p, f]) => `${p}:${f.sha256}`)
      .join('\n'),
  );
  return 'local-' + digest.slice(0, 16);
}

/** Any path segment starting with "." (editor swap files, sed's temp files, our own temp files) is not a change. */
const isIgnoredPath = rel => rel.split('/').some(part => part.startsWith('.'));

/** The listed files' relative paths (no symlinks, no dot names), directories walked in name order, at most `limit`. */
async function collectFiles(root, limit) {
  const rels = [];
  const seen = new Set();
  let truncated = false;
  const visit = async (relDir, descend) => {
    const dir = relDir === '' ? root : path.join(root, ...relDir.split('/'));
    let entries;
    try {
      entries = await fsp.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const entry of entries) {
      if (truncated) return;
      if (entry.name.startsWith('.')) continue;
      const rel = relDir === '' ? entry.name : `${relDir}/${entry.name}`;
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

/** Atomic write: a dot-named temp file in the same directory (listing and watching skip it), then rename. */
async function writeFileAtomic(file, bytes) {
  await fsp.mkdir(path.dirname(file), { recursive: true });
  const tmp = path.join(path.dirname(file), `.${path.basename(file)}.${randomUUID()}.tmp`);
  try {
    await fsp.writeFile(tmp, bytes);
    await fsp.rename(tmp, file);
  } catch (error) {
    await fsp.rm(tmp, { force: true }).catch(() => {});
    throw error;
  }
}

/** The artifact's files under <root>/project: listing, reads, saves, uploads. */
class Store {
  constructor(root, log) {
    this.root = root;
    this.log = log;
    /** project/<path> → sha256 of the page's last save not yet seen by the watcher ('' for a delete). */
    this.ownWrites = new Map();
    this.queue = Promise.resolve();
    this.seq = 0;
    this.truncationReported = false;
  }

  /** Run `work` after every save, upload and change check before it, and before the next. */
  exclusive(work) {
    const run = this.queue.then(work);
    this.queue = run.catch(() => undefined);
    return run;
  }

  /** project/<path> → its path relative to project/, or null when the editor may not see or write it. */
  fileOf(runtimePath) {
    if (!isProjectPath(runtimePath)) return null;
    const rel = runtimePath.slice('project/'.length);
    return LAYOUT.isFile(rel) ? rel : null;
  }

  /** The file on disk (it may not exist yet); null when a directory on the way is a symlink or the name is not a file. */
  async diskPath(rel) {
    const realRoot = await fsp.realpath(this.root).catch(() => null);
    if (realRoot === null) return null;
    const file = path.join(realRoot, ...rel.split('/'));
    // The nearest existing directory above the file must be its own real path.
    for (let dir = path.dirname(file); ; dir = path.dirname(dir)) {
      const real = await fsp.realpath(dir).catch(() => null);
      if (real === null) {
        if (path.dirname(dir) === dir) return null;
        continue;
      }
      if (real !== dir) return null;
      break;
    }
    const info = await fsp.lstat(file).catch(() => null);
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
      const bytes = await fsp.readFile(file).catch(() => null);
      if (bytes === null) continue;
      files[`project/${rel}`] = { sha256: sha256(bytes), size: bytes.length, contentType: contentTypeOf(rel) };
    }
    return { ver: versionOf(files), files };
  }

  async readProjectFile(p) {
    const rel = this.fileOf(p);
    const file = rel === null ? null : await this.diskPath(rel);
    if (file === null) return null;
    return fsp.readFile(file).catch(() => null);
  }

  /** A save from the page: all entries or none (ifMatch is checked for all before anything is written). */
  publish(batch) {
    return this.exclusive(() => this.publishNow(batch));
  }

  async publishNow(batch) {
    const files = new Map();
    let total = 0;
    for (const [p, entry] of Object.entries(batch)) {
      const rel = this.fileOf(p);
      const file = rel === null ? null : await this.diskPath(rel);
      if (file === null) return { status: 400, body: { code: 'read_only_path', message: LAYOUT.readOnlyMessage(p) } };
      files.set(p, file);
      if (!isWriteEntry(entry)) continue;
      const bytes = Buffer.byteLength(entry.base64, 'base64');
      if (bytes > LAYOUT.maxFileBytes) {
        return { status: 413, body: { code: 'too_large', message: `${p}: a file can be at most ${LAYOUT.maxFileBytes} bytes` } };
      }
      total += bytes;
    }
    if (total > LAYOUT.maxPublishBytes) {
      return { status: 413, body: { code: 'too_large', message: `a publish can write at most ${LAYOUT.maxPublishBytes} bytes` } };
    }
    const before = await this.listing();
    const conflicts = [];
    for (const [p, entry] of Object.entries(batch)) {
      // undefined: no check; null: the file must not exist yet; a sha: the file must have exactly that content.
      const expected = entry?.ifMatch;
      if (expected === undefined) continue;
      const actual = before.files[p]?.sha256 ?? null;
      if (actual !== expected) conflicts.push({ path: p, actual, expected });
    }
    if (conflicts.length > 0) return { status: 409, body: { code: 'conflict', live: before.ver, paths: conflicts } };

    const shas = {};
    for (const [p, entry] of Object.entries(batch)) {
      const file = files.get(p);
      if (!isWriteEntry(entry)) {
        this.ownWrites.set(p, '');
        await fsp.rm(file, { force: true });
        continue;
      }
      const bytes = Buffer.from(entry.base64, 'base64');
      const sha = sha256(bytes);
      // Remember it before writing: the watcher may fire before the write returns.
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
      const parsed = JSON.parse(await fsp.readFile(file, 'utf8'));
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
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
    const type = contentType.split(';')[0].trim().toLowerCase() || 'application/octet-stream';
    if ((await this.findBlobFile(id)) === null) {
      const file = await this.diskPath(`${LAYOUT.blobDir}/${id}.${assetExtensionOf(type)}`);
      if (file === null) throw new Error(`${LAYOUT.blobDir} directory is not writable`);
      await writeFileAtomic(file, bytes);
    }
    const index = await this.assetIndex();
    const indexFile = await this.diskPath(`${LAYOUT.blobDir}/${ASSET_INDEX}`);
    if (index[id] !== type && indexFile !== null) {
      index[id] = type;
      await writeFileAtomic(indexFile, Buffer.from(JSON.stringify(index, null, 2) + '\n'));
    }
    return { id, url: `/_blob/${id}`, sizeBytes: bytes.byteLength };
  }

  async findBlobFile(id) {
    try {
      const names = await fsp.readdir(path.join(this.root, LAYOUT.blobDir));
      const name = names.find(n => n.startsWith(`${id}.`) && !n.endsWith('.tmp'));
      if (name === undefined) return null;
      const file = await this.diskPath(`${LAYOUT.blobDir}/${name}`);
      return file !== null && (await fsp.lstat(file).catch(() => null))?.isFile() ? file : null;
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
      let sha = '';
      try {
        const file = await this.diskPath(rel);
        if (file !== null && (await fsp.lstat(file)).isFile()) sha = sha256(await fsp.readFile(file));
      } catch {
        sha = '';
      }
      if (this.ownWrites.get(p) !== sha && seen.get(p) !== sha) external.push(p);
      this.ownWrites.delete(p);
      seen.set(p, sha);
    }
    return external;
  }
}

/**
 * Watch the artifact folder for changes made outside the page. One non-recursive fs.watch per directory (a recursive
 * watch on Linux follows file inodes and loses a file after an atomic save), rebuilt when directories come and go,
 * plus a stat poll in case the OS drops an event. A change is debounced, then checked by content inside the store's
 * queue; `onChange` gets {type: 'external-change', paths, ver}. Returns a function that stops watching.
 */
function watchArtifact(store, onChange, onError) {
  let timer;
  let stopped = false;
  const watchers = new Map();
  let seen = null;
  let pollSignature = null;
  let polling = false;
  const maxDirectories = LAYOUT.maxFiles;

  const schedule = () => {
    if (stopped) return;
    clearTimeout(timer);
    timer = setTimeout(() => void store.exclusive(flush), WATCH_DEBOUNCE_MS);
  };

  const refresh = () => {
    const directories = new Map();
    const visit = (rel, descend) => {
      if (directories.size >= maxDirectories) return;
      const dir = rel === '' ? store.root : path.join(store.root, ...rel.split('/'));
      if (directories.has(dir) || !fs.existsSync(dir)) return;
      const info = fs.lstatSync(dir);
      if (!info.isDirectory()) return;
      directories.set(dir, `${info.dev}:${info.ino}`);
      if (!descend) return;
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
        const child = rel === '' ? entry.name : `${rel}/${entry.name}`;
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
        watcher = fs.watch(dir, (event, name) => {
          if (stopped) return;
          if (name) {
            const changed = path.join(dir, String(name));
            // A watched directory renamed or removed: drop its handle (and its subdirectories'); refresh adds new ones.
            if (event === 'rename' && watchers.has(changed)) {
              for (const [watchedDir, item] of watchers) {
                if (watchedDir === changed || watchedDir.startsWith(changed + path.sep)) {
                  item.watcher.close();
                  watchers.delete(watchedDir);
                }
              }
            }
            const rel = path.relative(store.root, changed).split(path.sep).join('/');
            if (isIgnoredPath(rel) || !LAYOUT.watches(rel)) return;
          }
          schedule();
        });
      } catch (error) {
        onError(error);
        continue;
      }
      watcher.on('error', onError);
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
      const external = await store.externalChanges(new Set([...seen.keys(), ...Object.keys(current.files)]), seen);
      if (stopped || external.length === 0) return;
      onChange({ type: 'external-change', paths: external, ver: (await store.listing()).ver });
    } catch (error) {
      onError(error);
    }
  };

  /** Sizes, times and inodes of the listed files: cheap to take, changes whenever a file does. */
  const signature = async () => {
    const { rels } = await collectFiles(store.root, LAYOUT.maxFiles);
    const parts = [];
    for (const rel of rels) {
      const info = await fsp.lstat(path.join(store.root, ...rel.split('/'))).catch(() => null);
      parts.push(info ? `${rel}\0${info.size}\0${info.mtimeMs}\0${info.ino}` : `${rel}\0-`);
    }
    return parts.join('\n');
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
  }, POLL_MS);
  poll.unref?.();

  // The first pass records what is on disk now; only later differences are changes.
  void store.exclusive(flush);
  return () => {
    stopped = true;
    clearTimeout(timer);
    clearInterval(poll);
    for (const item of watchers.values()) item.watcher.close();
    watchers.clear();
  };
}

// ---------- HTTP ----------

function sendJson(response, status, body, headers = {}) {
  const text = JSON.stringify(body);
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(text),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...headers,
  });
  response.end(text);
}

const publishError = (response, status, code, message) => sendJson(response, status, { code, message });

class TooLarge extends Error {}

function readBody(request, limit) {
  return new Promise((resolve, reject) => {
    const declared = Number(request.headers['content-length']);
    if (Number.isFinite(declared) && declared > limit) {
      reject(new TooLarge());
      request.resume();
      return;
    }
    const chunks = [];
    let size = 0;
    request.on('data', chunk => {
      size += chunk.length;
      if (size > limit) {
        reject(new TooLarge());
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => resolve(Buffer.concat(chunks)));
    request.on('error', reject);
  });
}

/** Writes come only from the editor page itself (same origin) or from a client that sends no Origin. */
function sameOrigin(request) {
  const origin = request.headers.origin;
  if (origin === undefined) return true;
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
  if (request.method === 'HEAD') {
    response.end();
    return;
  }
  const stream = fs.createReadStream(file);
  stream.on('error', () => response.destroy());
  response.on('close', () => stream.destroy());
  stream.pipe(response);
}

/**
 * Serve the artifact at <root> (its files in <root>/project). Resolves once listening, with {url, port, grant, close}.
 * `log` gets one line per event worth keeping (saves, uploads, external changes, errors).
 */
export async function startServer({ root, port = 0, host = '127.0.0.1', log = line => process.stderr.write(`${line}\n`) }) {
  const project = path.join(root, 'project');
  const stamp = line => log(`[${new Date().toISOString()}] ${line}`);
  const store = new Store(await fsp.realpath(project), stamp);
  const grant = randomBytes(24).toString('base64url');
  const editorPath = `/${KIND}/${grant}/`;
  const boot = randomBytes(6).toString('hex');
  const clients = new Set();
  const changes = [];
  let changeSeq = 0;
  const pageCache = new Map();

  const eventId = () => `${boot}.${changeSeq}`;
  const frame = event => `id: ${eventId()}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;

  const stopWatch = watchArtifact(
    store,
    event => {
      changeSeq += 1;
      changes.push({ seq: changeSeq, paths: event.paths });
      if (changes.length > CHANGE_LOG_SIZE) changes.shift();
      stamp(`changed on disk: ${event.paths.join(', ')}${clients.size ? '' : ' (no page open)'}`);
      for (const client of clients) client.write(frame(event));
    },
    error => stamp(`watching failed: ${error?.message ?? error}`),
  );

  const events = async (request, response) => {
    response.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    response.write(': connected\n\n');
    // A reconnecting stream sends the last id it saw: tell it about the changes it missed while it was away.
    const last = /^([0-9a-f]+)\.(\d+)$/.exec(String(request.headers['last-event-id'] ?? ''));
    const missedSince = last && last[1] === boot ? Number(last[2]) : null;
    if (missedSince !== null && missedSince < changeSeq) {
      const missed = changes.filter(c => c.seq > missedSince);
      const paths = [...new Set((missed.length ? missed : changes).flatMap(c => c.paths))];
      response.write(frame({ type: 'external-change', paths, ver: (await store.listing()).ver }));
    } else {
      // An id with no data sets the stream's last event id and dispatches nothing.
      response.write(`id: ${eventId()}\n\n`);
    }
    clients.add(response);
    const keepAlive = setInterval(() => response.write(': ping\n\n'), SSE_KEEPALIVE_MS);
    keepAlive.unref?.();
    const done = () => {
      clearInterval(keepAlive);
      clients.delete(response);
    };
    request.on('close', done);
    response.on('close', done);
  };

  const serveBlob = async (request, response, id) => {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405, { Allow: 'GET, HEAD' }).end();
      return;
    }
    const found = await store.blobFile(id);
    const info = found === null ? null : await fsp.stat(found.file).catch(() => null);
    if (!info?.isFile()) {
      response.writeHead(404, { 'Cache-Control': 'no-store' }).end();
      return;
    }
    sendFile(request, response, found.file, {
      'Content-Type': found.contentType,
      'Content-Length': info.size,
      // Addressed by content: an id's bytes never change.
      'Cache-Control': 'private, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': DATA_CSP,
    });
  };

  const serveEditor = async (request, response, rest) => {
    const parts = rest === '' ? ['index.html'] : rest.split('/');
    // node/ in an editor folder holds tools for `artifact.mjs check` (the slides compiler); it is not part of the page.
    const invalid = parts.some(p => p === '' || p === '.' || p === '..' || p.startsWith('.') || p.includes('\\')) || parts[0] === 'node';
    const realDist = invalid ? null : await fsp.realpath(EDITOR_DIR).catch(() => null);
    const file = realDist === null ? null : path.join(realDist, ...parts);
    const real = file === null ? null : await fsp.realpath(file).catch(() => null);
    const info = real === null ? null : await fsp.lstat(real).catch(() => null);
    if (file === null || real !== file || !info?.isFile()) {
      if (realDist === null && !invalid && parts[0] === 'index.html') {
        response.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }).end('The editor page is missing; reinstall the skill.');
        return;
      }
      response.writeHead(404, { 'Cache-Control': 'no-store' }).end();
      return;
    }
    const ext = path.extname(file).toLowerCase();
    const type = STATIC_TYPES[ext] ?? 'application/octet-stream';
    if (ext === '.html') {
      const key = parts.join('/');
      let page = pageCache.get(key);
      if (!page || page.mtimeMs !== info.mtimeMs) {
        const html = await fsp.readFile(file, 'utf8');
        page = { mtimeMs: info.mtimeMs, body: Buffer.from(html), csp: pageCsp(pageScriptSrc(html)) };
        pageCache.set(key, page);
      }
      response.writeHead(200, {
        'Content-Type': type,
        'Content-Length': page.body.length,
        'Cache-Control': 'no-cache',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer',
        'Content-Security-Policy': page.csp,
      });
      response.end(request.method === 'HEAD' ? undefined : page.body);
      return;
    }
    sendFile(request, response, file, {
      'Content-Type': type,
      'Content-Length': info.size,
      // The page's build names its assets by content hash.
      'Cache-Control': parts[0] === 'assets' ? 'private, max-age=31536000, immutable' : 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    });
  };

  const publish = async (request, response) => {
    if (!/^application\/json\b/i.test(request.headers['content-type'] ?? '')) {
      publishError(response, 415, 'invalid_content', 'expected application/json');
      return;
    }
    const raw = await readBody(request, MAX_PUBLISH_BYTES);
    let files;
    try {
      const body = JSON.parse(raw.toString('utf8'));
      if (typeof body?.files !== 'object' || body.files === null || Array.isArray(body.files)) throw new Error('files');
      if (!Object.values(body.files).every(isWireEntry)) throw new Error('entry');
      files = body.files;
    } catch {
      publishError(response, 400, 'invalid_content', 'malformed publish request');
      return;
    }
    const outcome = await store.publish(files);
    const names = Object.keys(files).map(p => p.replace(/^project\//, ''));
    stamp(`saved from the page (${outcome.status}${outcome.body.code ? ` ${outcome.body.code}` : ''}): ${names.join(', ')}`);
    sendJson(response, outcome.status, outcome.body);
  };

  const upload = async (request, response) => {
    const contentType = request.headers['content-type'] ?? 'application/octet-stream';
    const limit = Math.min(MAX_ASSET_BYTES, LAYOUT.maxBlobBytes(contentType));
    const bytes = await readBody(request, limit);
    if (bytes.length === 0) {
      publishError(response, 400, 'invalid_content', 'empty upload');
      return;
    }
    const result = await store.putBlob(bytes, contentType);
    stamp(`uploaded from the page: ${result.url} (${contentType}, ${bytes.length} bytes)`);
    sendJson(response, 200, result);
  };

  const route = async (request, response, rest) => {
    const method = request.method ?? 'GET';
    if (rest === ROUTES.publish || rest === ROUTES.assets) {
      if (method !== 'POST') {
        response.writeHead(405, { Allow: 'POST' }).end();
        return;
      }
      if (!sameOrigin(request)) {
        request.resume();
        publishError(response, 403, 'not_writer', 'cross-origin request');
        return;
      }
      if (rest === ROUTES.publish) await publish(request, response);
      else await upload(request, response);
      return;
    }
    if (method !== 'GET' && method !== 'HEAD') {
      response.writeHead(405, { Allow: 'GET, HEAD' }).end();
      return;
    }
    if (rest === ROUTES.listing) return sendJson(response, 200, await store.listing());
    if (rest === ROUTES.session) return sendJson(response, 200, { canEdit: true, ...sessionExtras() });
    if (rest === ROUTES.events) return events(request, response);
    if (rest.startsWith('project/')) {
      const bytes = await store.readProjectFile(rest);
      if (bytes === null) {
        response.writeHead(404, { 'Cache-Control': 'no-store' }).end();
        return;
      }
      response.writeHead(200, {
        'Content-Type': contentTypeOf(rest),
        'Content-Length': bytes.byteLength,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': DATA_CSP,
      });
      response.end(method === 'HEAD' ? undefined : bytes);
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
      if (error instanceof TooLarge) {
        if (!response.headersSent) publishError(response, 413, 'too_large', 'request body is too large');
        return;
      }
      stamp(`request failed: ${error?.stack ?? error}`);
      if (!response.headersSent) publishError(response, 500, 'upstream_error', 'internal error');
      else response.destroy();
    }
  };

  const server = http.createServer((request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    const pathname = url.pathname;
    if (pathname === '/' || pathname === '/index.html') {
      response.writeHead(302, { Location: editorPath, 'Cache-Control': 'no-store' }).end();
      return;
    }
    if (pathname === '/favicon.ico') {
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
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }).end('Not found');
      return;
    }
    if (match[3] === undefined) {
      // The page fetches _files.json, project/… relative to its own address, which must end in /.
      response.writeHead(308, { Location: `${editorPath}${url.search}`, 'Cache-Control': 'no-store' }).end();
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

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => resolve());
  });
  const address = server.address();
  const actualPort = typeof address === 'object' && address ? address.port : port;
  const shownHost = host === '0.0.0.0' || host === '::' ? '127.0.0.1' : host.includes(':') ? `[${host}]` : host;
  const url = `http://${shownHost}:${actualPort}${editorPath}`;
  stamp(`serving ${project} at ${url}`);
  const close = () => {
    stopWatch();
    for (const client of clients) client.end();
    clients.clear();
    server.close();
    server.closeAllConnections?.();
  };
  return { url, port: actualPort, grant, close };
}

/** What this server serves, for `artifact.mjs` and tests. */
export { KIND, NOUN, INDEX_FILE, LAYOUT };

// ---------- the background-server state file ----------

export function readState(root) {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, STATE_FILE), 'utf8'));
  } catch {
    return null;
  }
}

function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === 'EPERM';
  }
}

/** The server already running for this folder, if it answers. */
export async function runningServer(root) {
  const state = readState(root);
  if (!state || state.kind !== KIND || !alive(state.pid)) return null;
  try {
    const response = await fetch(new URL(ROUTES.session, state.url), { signal: AbortSignal.timeout(2000) });
    return response.ok ? state : null;
  } catch {
    return null;
  }
}

/** Start serving in this process, record it in <root>/.artifact-server.json, and remove that on SIGINT/SIGTERM. */
export async function serveForeground({ root, port, host }) {
  const running = await startServer({ root, port, host });
  const state = { pid: process.pid, url: running.url, port: running.port, root, kind: KIND, startedAt: new Date().toISOString() };
  fs.writeFileSync(path.join(root, STATE_FILE), `${JSON.stringify(state, null, 2)}\n`);
  const shutdown = () => {
    if (readState(root)?.pid === process.pid) fs.rmSync(path.join(root, STATE_FILE), { force: true });
    running.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  return state;
}

// ---------- command line ----------

async function main(argv) {
  const positional = [];
  const flags = new Map();
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) positional.push(arg);
    else if (arg.includes('=')) flags.set(arg.slice(2, arg.indexOf('=')), arg.slice(arg.indexOf('=') + 1));
    else flags.set(arg.slice(2), argv[++i] ?? '');
  }
  if (positional.length !== 1 || flags.has('help')) {
    process.stderr.write(`Usage: node ${path.basename(SCRIPT)} <root> [--port n] [--host h]\n<root> holds project/${INDEX_FILE}.\n`);
    return 2;
  }
  let root = path.resolve(positional[0]);
  if (path.basename(root) === 'project' && fs.existsSync(path.join(root, INDEX_FILE)) && !fs.existsSync(path.join(root, 'project'))) {
    root = path.dirname(root);
  }
  if (!fs.statSync(path.join(root, 'project', INDEX_FILE), { throwIfNoEntry: false })?.isFile()) {
    process.stderr.write(`${JSON.stringify({ error: 'NOT_FOUND', message: `${path.join(root, 'project', INDEX_FILE)} does not exist.` })}\n`);
    return 2;
  }
  const port = Number(flags.get('port') ?? 0);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    process.stderr.write(`${JSON.stringify({ error: 'INVALID_PORT', message: '--port is a number from 0 to 65535.' })}\n`);
    return 2;
  }
  const existing = await runningServer(root);
  if (existing) {
    process.stdout.write(`${JSON.stringify({ url: existing.url, root, pid: existing.pid, reused: true }, null, 2)}\n`);
    return 0;
  }
  const state = await serveForeground({ root, port, host: flags.get('host') ?? '127.0.0.1' });
  process.stdout.write(`${JSON.stringify({ url: state.url, root, pid: state.pid }, null, 2)}\n`);
  return -1;
}

/** Run as a script (also through a symlinked skills folder: Node loads the main module by its real path). */
function isMain() {
  try {
    return Boolean(process.argv[1]) && pathToFileURL(fs.realpathSync(process.argv[1])).href === import.meta.url;
  } catch {
    return false;
  }
}

if (isMain()) {
  main(process.argv.slice(2)).then(
    code => {
      if (code >= 0) process.exitCode = code;
    },
    error => {
      process.stderr.write(`${JSON.stringify({ error: 'SERVER_FAILED', message: error?.message ?? String(error) })}\n`);
      process.exitCode = 2;
    },
  );
}

