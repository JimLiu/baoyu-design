/**
 * Local stand-in for the claude.ai Artifact tool, one build per skill (claude-slides, claude-design,
 * claude-design-system). Bundled by build.mjs into `skills/<skill>/scripts/artifact.mjs`; `__KIND__` picks the type.
 *
 * An artifact is a folder `<root>` whose files sit under `<root>/project/`, exactly the paths the type's
 * SKILL.md names (`project/deck.json`, `project/Main.dc.html`, `project/design-system.json`, …). Uploads live
 * beside them (`project/assets/` or `project/_blobs/`) and are addressed as `/_blob/<id>`.
 *
 *   open   <root> [--port n] [--host h]   start the editor server in the background, print its URL
 *   serve  <root> [--port n] [--host h]   the same, in the foreground
 *   stop   <root>                         stop the background server
 *   check  <root>                         validate the files; exit 1 while problems remain
 *   upload <root> <file> [--group G]      store an image/font/… as an upload, print its /_blob/<id> (--group: design systems)
 *   list   [dir …]                        find design systems (folders holding project/design-system.json)
 *
 * The editor pages and the checks come from BaoCut (@baocut/slides, @baocut/design, @baocut/design-system). The editor
 * server is not bundled: it is the skill's own hand-written scripts/server.mjs (plain Node, built-ins only), which
 * open/serve start and which writes <root>/.artifact-server.json.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  checkDeck,
  contentTypeOf,
  DeckStore,
  DECK_LAYOUT,
  loadSlidesCompiler,
  problemCount,
  readDeckSummary,
  type DeckLayout,
  type EditorKind,
} from '@baocut/slides';
import { CANVAS_FILE, CANVAS_LAYOUT, checkCanvas, readCanvasInfo } from '@baocut/design';
import {
  checkDesignSystem,
  DESIGN_SYSTEM_FILE,
  DESIGN_SYSTEM_LAYOUT,
  DESIGN_SYSTEM_PATHS,
  designSystemUploadLimit,
  encodeIndexKey,
  isAssetGroupName,
  readDesignSystemInfo,
} from '@baocut/design-system';

declare const __KIND__: EditorKind;
declare const __SKILL__: string;

// The slides compiler touches globalThis.localStorage, which newer Node versions warn about; the warning is noise here.
const emitWarning = process.emitWarning.bind(process);
process.emitWarning = ((warning: string | Error, ...rest: unknown[]) => {
  if (String(typeof warning === 'string' ? warning : warning.message).includes('localStorage')) return;
  (emitWarning as (w: string | Error, ...r: unknown[]) => void)(warning, ...rest);
}) as typeof process.emitWarning;

const KIND: EditorKind = __KIND__;
const SCRIPT = fileURLToPath(import.meta.url);
const EDITOR_DIR = path.join(path.dirname(SCRIPT), 'editor');
/** The skill's editor server (hand-written, not bundled). */
const SERVER_SCRIPT = path.join(path.dirname(SCRIPT), 'server.mjs');
const STATE_FILE = '.artifact-server.json';
const LOG_FILE = '.artifact-server.log';
const MAX_LISTED = 200;
const UPLOAD_MAX_BYTES = 20 * 1024 * 1024;

const INDEX_FILE = KIND === 'slides' ? 'deck.json' : KIND === 'design' ? CANVAS_FILE : DESIGN_SYSTEM_FILE;
const LAYOUT: DeckLayout = KIND === 'slides' ? DECK_LAYOUT : KIND === 'design' ? CANVAS_LAYOUT : DESIGN_SYSTEM_LAYOUT;
const NOUN = KIND === 'slides' ? 'deck' : KIND === 'design' ? 'design' : 'design system';

class CliError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

// ---------- arguments ----------

interface Parsed {
  positional: string[];
  flags: Map<string, string>;
}

function parseArgs(argv: string[]): Parsed {
  const positional: string[] = [];
  const flags = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg.startsWith('--')) {
      const eq = arg.indexOf('=');
      if (eq > 0) flags.set(arg.slice(2, eq), arg.slice(eq + 1));
      else if (i + 1 < argv.length && !argv[i + 1]!.startsWith('--')) flags.set(arg.slice(2), argv[++i]!);
      else flags.set(arg.slice(2), 'true');
    } else positional.push(arg);
  }
  return { positional, flags };
}

function print(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

const script = (cmd: string, ...args: string[]) => ['node', quote(SCRIPT), cmd, ...args.map(quote)].join(' ');
function quote(s: string): string {
  return /^[A-Za-z0-9_./:@%+=-]+$/.test(s) ? s : `'${s.replace(/'/g, `'\\''`)}'`;
}

// ---------- the artifact folder ----------

interface Artifact {
  /** The artifact folder (holds project/). */
  root: string;
  /** `<root>/project`: what the editor sees as `project/…`. */
  project: string;
}

/** `<root>` is the artifact folder; `<root>/project` is accepted too. */
function resolveArtifact(given: string | undefined, mustExist = true): Artifact {
  if (!given) throw new CliError('MISSING_ROOT', `Give the artifact folder: the one that holds project/${INDEX_FILE}.`);
  let root = path.resolve(given);
  if (path.basename(root) === 'project' && fs.existsSync(path.join(root, INDEX_FILE)) && !fs.existsSync(path.join(root, 'project'))) {
    root = path.dirname(root);
  }
  const project = path.join(root, 'project');
  if (mustExist) {
    const stat = fs.statSync(project, { throwIfNoEntry: false });
    if (!stat?.isDirectory()) {
      throw new CliError('NOT_FOUND', `${project} does not exist. Write project/${INDEX_FILE} and the other files under ${root} first.`);
    }
  }
  return { root, project };
}

async function readInfo(project: string): Promise<Record<string, unknown> | null> {
  if (KIND === 'slides') return (await readDeckSummary(project)) as Record<string, unknown> | null;
  if (KIND === 'design') return (await readCanvasInfo(project)) as Record<string, unknown> | null;
  return (await readDesignSystemInfo(project)) as Record<string, unknown> | null;
}

/** BaoCut's check messages name its own agent tools; here they are subcommands of this script. */
function localize<T>(value: T): T {
  const text = JSON.stringify(value)
    .replace(/\b(?:design_system|design|slides)_import_asset\b/g, 'artifact.mjs upload')
    .replace(/\b(?:design_system|design|slides)_check\b/g, 'artifact.mjs check')
    .replace(
      /BaoCut previews load nothing from the network but Google Fonts \(no CDN in the page CSP\)/g,
      'previews here load nothing from the network but Google Fonts: make the library a file in components/lib/ with a libraries entry (format.md); React 18 comes with the page',
    );
  return JSON.parse(text) as T;
}

/**
 * A deck's or canvas's design systems: each record should have its copy under project/ds/<namespace>/ with the
 * system's tokens.json, or the Theme and color menus show bare hexes. A system may have no tokens.json, so these are
 * notes, not problems.
 */
function designSystemNotes(project: string, indexFile: string): string[] {
  let index: unknown;
  try {
    index = JSON.parse(fs.readFileSync(path.join(project, indexFile), 'utf8'));
  } catch {
    return [];
  }
  const list = (index as { designSystems?: unknown } | null)?.designSystems;
  const records = Array.isArray(list) ? list : list && typeof list === 'object' ? Object.values(list) : [];
  const notes: string[] = [];
  for (const record of records) {
    const ns = (record as { namespace?: unknown } | null)?.namespace;
    if (typeof ns !== 'string') continue;
    if (!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(ns)) {
      notes.push(`designSystems namespace ${JSON.stringify(ns)} is not a folder name ([a-z0-9][a-z0-9_-]{0,63}): the page skips it. Use the lower-case folder (list prints it as folder), the same in the record and in project/ds/<folder>/.`);
      continue;
    }
    const folder = path.join(project, 'ds', ns);
    if (!fs.existsSync(folder)) {
      notes.push(`designSystems names "${ns}" but project/ds/${ns}/ does not exist: copy the system's project/tokens.json (and the files you use) there, or take the record out.`);
    } else if (!fs.existsSync(path.join(folder, 'tokens.json'))) {
      notes.push(`project/ds/${ns}/ has no tokens.json, so the Theme and color menus show bare hexes: copy the system's project/tokens.json there (a system with none: nothing to do).`);
    }
  }
  return notes;
}

// ---------- check ----------

async function check(a: Artifact): Promise<{ result: Record<string, unknown>; problems: number }> {
  if (KIND === 'slides') {
    let rt;
    try {
      rt = loadSlidesCompiler(EDITOR_DIR);
    } catch {
      throw new CliError('COMPILER_MISSING', `The slides compiler is missing (${path.join(EDITOR_DIR, 'node', 'compiler.cjs')}); reinstall the skill.`);
    }
    if (!fs.existsSync(path.join(a.project, 'deck.json'))) {
      return {
        problems: 1,
        result: {
          root: a.root,
          slideCount: 0,
          problems: 1,
          deckProblems: ['deck.json: missing: a deck needs project/deck.json with "v": 4, "title" and "order" (Creating, step 4)'],
          next: 'Write project/deck.json and the slides, then run check again until problems is 0.',
        },
      };
    }
    let report;
    try {
      report = checkDeck(rt, a.project, { verbose: true });
    } catch (error) {
      throw new CliError('CHECK_FAILED', `The check did not finish: ${(error as Error).message}. Is project/deck.json valid JSON?`);
    }
    const problems = problemCount(report);
    const slides = report.slides
      .filter(s => s.problems.length > 0 || s.notes.length > 0 || s.roundTripDrift)
      .map(s => ({
        id: s.id,
        ...(s.problems.length > 0 ? { problems: s.problems } : {}),
        ...(s.notes.length > 0 ? { notes: s.notes } : {}),
        ...(s.roundTripDrift ? { roundTripDrift: true } : {}),
      }));
    const layoutNotes = slides.some(s => s.notes?.some(n => n.startsWith('排版') || n.startsWith('警告')));
    const dsNotes = designSystemNotes(a.project, 'deck.json');
    return {
      problems,
      result: {
        root: a.root,
        title: report.title,
        slideCount: report.slides.length,
        problems,
        ...(report.deckProblems.length > 0 ? { deckProblems: report.deckProblems } : {}),
        ...(report.orphans.length > 0 ? { orphans: report.orphans } : {}),
        ...(slides.length > 0 ? { slides } : {}),
        ...(dsNotes.length > 0 ? { designSystemNotes: dsNotes } : {}),
        notChecked: 'Text sizes, contrast, whether a section id matches its file name and whether an image path exists are not checked (nothing is rendered).',
        next:
          problems > 0
            ? 'Fix the files named in deckProblems and in each slide\'s problems (paths are under project/), then run check again until problems is 0. notes are hints and lose no content; fix the layout ones (starting "排版") and the warnings (starting "警告": a font or image falls back) too.'
            : `No problems. Show it to the user: ${script('open', a.root)} prints the editor URL.` +
              (layoutNotes ? ' Some slides carry layout notes ("排版": content may overflow or overlap) or warnings ("警告": a font or image falls back); fix them and check again.' : '') +
              (report.orphans.length > 0 ? ' orphans are slide files missing from order: they do not show; delete the unneeded ones.' : '') +
              (dsNotes.length > 0 ? ' Read designSystemNotes: a design system install looks incomplete.' : ''),
      },
    };
  }
  if (KIND === 'design') {
    const r = await checkCanvas(a.project);
    const problems = r.issues.length;
    const dsNotes = designSystemNotes(a.project, CANVAS_FILE);
    return {
      problems,
      result: {
        root: a.root,
        title: r.title,
        boardCount: r.boardCount,
        problems,
        ...(problems > 0 ? { issues: r.issues.slice(0, MAX_LISTED) } : {}),
        ...(problems > MAX_LISTED ? { more: `${problems - MAX_LISTED} more not listed: fix these, then check again` } : {}),
        ...(dsNotes.length > 0 ? { designSystemNotes: dsNotes } : {}),
        notChecked: 'Whether the artboard scripts run, and how the layout looks, is not checked (nothing is rendered).',
        next:
          problems > 0
            ? 'Fix the files per issues (file is a path under project/; "." is the whole folder), then run check again until problems is 0.'
            : `No problems. Show it to the user: ${script('open', a.root)} prints the editor URL.` +
              (dsNotes.length > 0 ? ' Read designSystemNotes: a design system install looks incomplete.' : ''),
      },
    };
  }
  const r = await checkDesignSystem(a.project);
  const problems = r.issues.length;
  if (fs.existsSync(path.join(a.project, DESIGN_SYSTEM_FILE))) {
    if (!fs.existsSync(path.join(a.project, 'README.md'))) {
      r.notes.push({ file: 'README.md', message: 'missing: every system includes project/README.md; every reader starts there (Creating, step 1)' });
    }
    if (!fs.existsSync(path.join(a.project, 'components', 'Cover', 'preview.html'))) {
      r.notes.push({ file: 'components/Cover/preview.html', message: 'missing: every system gets a cover, written last before the index (cover.md)' });
    }
  }
  return {
    problems,
    result: {
      root: a.root,
      title: r.title,
      namespace: r.namespace,
      problems,
      ...(problems > 0 ? { issues: r.issues.slice(0, MAX_LISTED) } : {}),
      ...(r.notes.length > 0 ? { notes: r.notes.slice(0, 50) } : {}),
      ...(problems > MAX_LISTED ? { more: `${problems - MAX_LISTED} more not listed: fix these, then check again` } : {}),
      notChecked: `${r.notChecked.join(', ')} are generated by the editor when it saves and are not checked; whether components render is not checked (nothing is rendered).`,
      next:
        problems > 0
          ? 'Fix the files per issues (file is a path under project/; "." is the whole folder), then run check again until problems is 0. Read the notes too: most need no change, but one naming a missing README or cover, or a file that hides an asset record, means a file to write or remove.'
          : `No problems. ${r.notes.length > 0 ? 'Read the notes: most need no change, but one naming a missing README or cover, or a file that hides an asset record, means a file to write or remove. ' : ''}Show it to the user: ${script('open', a.root)} prints the editor URL.`,
    },
  };
}

// ---------- upload ----------

const DESIGN_SYSTEM_UPLOAD_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'mp4', 'webm', 'pdf', 'woff2', 'woff', 'ttf', 'otf']);
const CANVAS_TEXT_UPLOADS = new Set(['css', 'js', 'mjs', 'json']);

function formatBytes(n: number): string {
  return n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(n / 1024)} KB`;
}

async function upload(a: Artifact, given: string | undefined, group: string | undefined): Promise<Record<string, unknown>> {
  if (!given) throw new CliError('MISSING_FILE', 'Give the file to upload.');
  const file = path.resolve(given);
  const stat = await fsp.stat(file).catch(() => null);
  if (!stat) throw new CliError('FILE_NOT_FOUND', `No such file: ${given}`);
  if (!stat.isFile()) throw new CliError('NOT_A_FILE', `${given} is not a regular file.`);
  const ext = path.extname(file).slice(1).toLowerCase();
  const type = contentTypeOf(file);
  const isMedia = type.startsWith('image/') || type.startsWith('font/');
  let limit = UPLOAD_MAX_BYTES;
  if (KIND === 'slides') {
    if (!isMedia) throw new CliError('UNSUPPORTED_TYPE', 'Only images (png, jpg, gif, webp, avif, svg) and fonts (woff2, woff, ttf, otf) can be uploaded, judged by extension. Convert other images to png first.');
  } else if (KIND === 'design') {
    if (!isMedia && !CANVAS_TEXT_UPLOADS.has(ext)) {
      throw new CliError('UNSUPPORTED_TYPE', 'Only images (png, jpg, gif, webp, avif, svg), fonts (woff2, woff, ttf, otf) and .css .js .json files can be uploaded, judged by extension.');
    }
  } else {
    if (!DESIGN_SYSTEM_UPLOAD_EXTENSIONS.has(ext)) {
      throw new CliError('UNSUPPORTED_TYPE', `Only ${[...DESIGN_SYSTEM_UPLOAD_EXTENSIONS].join(', ')} files can be uploaded, judged by extension. Text files (README.md, .json, .css, .js) are files, not uploads.`);
    }
    if (group === undefined) {
      throw new CliError('MISSING_GROUP', 'Give --group <Group>: a design system\'s uploads sit in an asset group (assets/<Group>/<file>). Fonts are files: copy them to project/fonts/ instead.');
    }
    if (!isAssetGroupName(group)) {
      throw new CliError('INVALID_GROUP', '--group is an asset group folder name: at most 80 characters, no / \\ or control characters, no surrounding spaces, not . or ..');
    }
    limit = designSystemUploadLimit(type);
  }
  if (stat.size > limit) throw new CliError('FILE_TOO_LARGE', `${given} is ${formatBytes(stat.size)}, over the ${formatBytes(limit)} limit: compress or shrink it first.`);

  const bytes = await fsp.readFile(file);
  const uploaded = await new DeckStore(a.project, LAYOUT).putBlob(bytes, type);
  const base = path.basename(file);
  if (KIND !== 'design-system') {
    return {
      url: uploaded.url,
      id: uploaded.id,
      bytes: uploaded.sizeBytes,
      contentType: type,
      next:
        KIND === 'slides'
          ? type.startsWith('font/')
            ? 'Put url verbatim as the src of its face in project/deck.json "faces", then run check once the deck is written.'
            : 'Put url verbatim in <img src="…">, then run check once project/deck.json is written.'
          : type.startsWith('font/')
            ? 'Use url verbatim in an @font-face src: url(…) in the <helmet><style> of the artboards that use it, then run check once project/canvas.json is written.'
            : 'Use url verbatim where this file is named (<img src>, url(…) in a <helmet><style> rule, fetch(…), <link href>, <script src>), never its filename, a path to it or a data: URI; then run check once project/canvas.json is written. (A design system\'s files are not uploads: they are copied under project/ds/<folder>/ and linked relatively.)',
    };
  }
  // A design system names each upload with a record in its index (format.md).
  const groupName = group!;
  const key = encodeIndexKey(base);
  const groupKey = encodeIndexKey(groupName);
  const record = { name: base, blob: uploaded.id, size: uploaded.sizeBytes, type };
  const shownAs = `${DESIGN_SYSTEM_PATHS.assetsDir}${groupName}/${base}`;
  return {
    url: uploaded.url,
    id: uploaded.id,
    bytes: uploaded.sizeBytes,
    contentType: type,
    record,
    indexPath: ['assetGroups', groupKey, 'files', key],
    shownAs,
    next:
      `Write record into project/design-system.json at assetGroups.${groupKey}.files.${key} and add ${JSON.stringify(base)} to that group's order ` +
      `(no such group yet: add {"name": ${JSON.stringify(groupName)}, "tile": "m", "order": [], "files": {}} and put ${JSON.stringify(groupName)} in groups). ` +
      `The page shows it as ${shownAs}; write no file at that path (a file wins over the record). Previews and other files reference it as url, verbatim. Then run check.`,
  };
}

// ---------- list design systems ----------

/** The project/ds/<folder>/ name a deck or canvas installs a system under: lower case, [a-z0-9][a-z0-9_-]{0,63}. */
function folderName(name: string): string {
  const folder = name
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^[-_]+/, '')
    .slice(0, 64)
    .replace(/-+$/, '');
  return /^[a-z0-9][a-z0-9_-]{0,63}$/.test(folder) ? folder : 'ds';
}

const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', 'out', 'vendor', 'target']);

async function listSystems(dirs: string[]): Promise<Record<string, unknown>[]> {
  const extra = (process.env.CLAUDE_DESIGN_SYSTEMS ?? '').split(path.delimiter).filter(Boolean);
  const starts = [...(dirs.length > 0 ? dirs : [process.cwd()]), ...extra].map(d => path.resolve(d));
  const found = new Map<string, Record<string, unknown>>();
  const visit = async (dir: string, depth: number): Promise<void> => {
    const project = path.join(dir, 'project');
    if (fs.existsSync(path.join(project, DESIGN_SYSTEM_FILE)) && !found.has(dir)) {
      const info = await readDesignSystemInfo(project).catch(() => null);
      if (info) {
        const namespace = (info as { namespace?: unknown }).namespace;
        found.set(dir, {
          title: info.title,
          namespace: namespace ?? null,
          folder: folderName(typeof namespace === 'string' && namespace.trim() ? namespace : String(info.title ?? '')),
          root: dir,
          readme: fs.existsSync(path.join(project, 'README.md')) ? path.join(project, 'README.md') : null,
          tokens: fs.existsSync(path.join(project, 'tokens.json')) ? path.join(project, 'tokens.json') : null,
        });
        return;
      }
    }
    if (depth <= 0) return;
    const entries = await fsp.readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.') || SKIP_DIRS.has(entry.name) || entry.name === 'project') continue;
      await visit(path.join(dir, entry.name), depth - 1);
    }
  };
  for (const start of starts) await visit(start, 4);
  return [...found.values()];
}

// ---------- the editor server ----------

interface ServerState {
  pid: number;
  url: string;
  port: number;
  root: string;
  kind: EditorKind;
  startedAt: string;
}

function readState(root: string): ServerState | null {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, STATE_FILE), 'utf8')) as ServerState;
  } catch {
    return null;
  }
}

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
}

/** The background server for this folder, if one is running and answering. */
async function runningServer(root: string): Promise<ServerState | null> {
  const state = readState(root);
  if (!state || state.kind !== KIND || !alive(state.pid)) return null;
  try {
    const response = await fetch(new URL('__deck/session', state.url), { signal: AbortSignal.timeout(2000) });
    return response.ok ? state : null;
  } catch {
    return null;
  }
}

function serverArgs(flags: Map<string, string>): string[] {
  const out: string[] = [];
  if (flags.has('port')) out.push('--port', flags.get('port')!);
  if (flags.has('host')) out.push('--host', flags.get('host')!);
  return out;
}

function assertServerFiles(): void {
  if (!fs.existsSync(path.join(EDITOR_DIR, 'index.html'))) {
    throw new CliError('EDITOR_MISSING', `The editor page is missing (${EDITOR_DIR}); reinstall the skill.`);
  }
  if (!fs.existsSync(SERVER_SCRIPT)) {
    throw new CliError('EDITOR_MISSING', `The editor server is missing (${SERVER_SCRIPT}); reinstall the skill.`);
  }
}

async function serve(a: Artifact, flags: Map<string, string>): Promise<void> {
  if (!(await readInfo(a.project))) {
    throw new CliError('NOT_A_' + KIND.toUpperCase().replace('-', '_'), `project/${INDEX_FILE} is missing or not a valid ${NOUN} index; write it, then run ${script('check', a.root)}.`);
  }
  assertServerFiles();
  const existing = await runningServer(a.root);
  if (existing && existing.pid !== process.pid) {
    print({ url: existing.url, root: a.root, pid: existing.pid, reused: true });
    return;
  }
  const host = flags.get('host') ?? '127.0.0.1';
  const port = Number(flags.get('port') ?? 0);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new CliError('INVALID_PORT', '--port is a number from 0 to 65535.');
  const server = (await import(pathToFileURL(SERVER_SCRIPT).href)) as {
    serveForeground(options: { root: string; port: number; host: string }): Promise<ServerState>;
  };
  const state = await server.serveForeground({ root: a.root, port, host });
  print({ url: state.url, root: a.root, pid: state.pid });
}

async function open(a: Artifact, flags: Map<string, string>): Promise<void> {
  if (!(await readInfo(a.project))) {
    throw new CliError('NOT_A_' + KIND.toUpperCase().replace('-', '_'), `project/${INDEX_FILE} is missing or not a valid ${NOUN} index; write it, then run ${script('check', a.root)}.`);
  }
  assertServerFiles();
  const existing = await runningServer(a.root);
  if (existing) {
    print({ url: existing.url, root: a.root, pid: existing.pid, reused: true });
    return;
  }
  const port = Number(flags.get('port') ?? 0);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new CliError('INVALID_PORT', '--port is a number from 0 to 65535.');
  const logFile = path.join(a.root, LOG_FILE);
  const fd = fs.openSync(logFile, 'a');
  // The server itself is the detached process, so its pid is the one recorded in the state file.
  const child = spawn(process.execPath, [SERVER_SCRIPT, a.root, ...serverArgs(flags)], { detached: true, stdio: ['ignore', 'ignore', fd] });
  child.unref();
  fs.closeSync(fd);
  let exited = false;
  child.once('exit', () => (exited = true));
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 150));
    const state = readState(a.root);
    if (state?.pid === child.pid) {
      print({ url: state.url, root: a.root, pid: state.pid, log: logFile, stop: script('stop', a.root) });
      return;
    }
    if (exited) break;
  }
  const tail = fs.existsSync(logFile) ? fs.readFileSync(logFile, 'utf8').split('\n').slice(-12).join('\n') : '';
  throw new CliError('SERVER_FAILED', `The editor server did not start. Run ${script('serve', a.root)} in the foreground to see why.${tail ? `\n${tail}` : ''}`);
}

async function stop(a: Artifact): Promise<void> {
  const state = readState(a.root);
  if (!state || !alive(state.pid)) {
    fs.rmSync(path.join(a.root, STATE_FILE), { force: true });
    print({ stopped: false, message: 'No editor server is running for this folder.' });
    return;
  }
  process.kill(state.pid, 'SIGTERM');
  // Return once the process is gone, so a check right after sees no server.
  const deadline = Date.now() + 5000;
  while (alive(state.pid) && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 100));
  if (alive(state.pid)) {
    print({ stopped: false, pid: state.pid, message: `The server did not exit within 5 s; end it with: kill ${state.pid}` });
    return;
  }
  fs.rmSync(path.join(a.root, STATE_FILE), { force: true });
  print({ stopped: true, pid: state.pid });
}

// ---------- main ----------

const USAGE = `${__SKILL__} — local Artifact tool for the ${NOUN} type

Usage:
  node scripts/artifact.mjs open   <root> [--port n] [--host h]   start the editor in the background; prints {"url"}
  node scripts/artifact.mjs serve  <root> [--port n] [--host h]   run the editor server in the foreground
  node scripts/artifact.mjs stop   <root>                         stop the background editor server
  node scripts/artifact.mjs check  <root>                         validate project/; exit 1 while problems remain
  node scripts/artifact.mjs upload <root> <file>${KIND === 'design-system' ? ' --group G  ' : '            '}      store an upload; prints its /_blob/<id> url
  node scripts/artifact.mjs list   [dir …]                        find design systems (folders holding project/design-system.json)

<root> is the artifact folder: its files live at <root>/project/<path> (project/${INDEX_FILE}, …).`;

async function main(): Promise<number> {
  const [command, ...rest] = process.argv.slice(2);
  const { positional, flags } = parseArgs(rest);
  switch (command) {
    case 'open':
      await open(resolveArtifact(positional[0]), flags);
      return 0;
    case 'serve':
      await serve(resolveArtifact(positional[0]), flags);
      return -1;
    case 'stop':
      await stop(resolveArtifact(positional[0], false));
      return 0;
    case 'check': {
      const { result, problems } = await check(resolveArtifact(positional[0]));
      print(localize(result));
      return problems > 0 ? 1 : 0;
    }
    case 'upload': {
      // An upload may come before the index is written (Creating step 2/3): make project/ for it.
      const a = resolveArtifact(positional[0], false);
      if (!fs.statSync(a.root, { throwIfNoEntry: false })?.isDirectory()) {
        throw new CliError('NOT_FOUND', `${a.root} does not exist. Make the artifact folder first.`);
      }
      fs.mkdirSync(a.project, { recursive: true });
      print(await upload(a, positional[1], flags.get('group')));
      return 0;
    }
    case 'list':
      print(await listSystems(positional));
      return 0;
    case undefined:
    case 'help':
    case '--help':
    case '-h':
      process.stdout.write(`${USAGE}\n`);
      return command === undefined ? 2 : 0;
    default:
      process.stderr.write(`Unknown command: ${command}\n\n${USAGE}\n`);
      return 2;
  }
}

main().then(
  code => {
    if (code >= 0) process.exitCode = code;
  },
  error => {
    const e = error as CliError;
    process.stderr.write(`${JSON.stringify({ error: e.code ?? 'ERROR', message: e.message })}\n`);
    process.exitCode = 2;
  },
);
