import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { AGENTS_DIR } from './helpers.mjs';

const SKILL_DIR = path.resolve(AGENTS_DIR, '..');
const readSkill = (relPath) => fs.readFileSync(path.join(SKILL_DIR, relPath), 'utf8');

test('vision probe agent has a strict read-only token protocol', () => {
  const probe = readSkill('agents/vision-probe-agent.md');

  assert.match(probe, /read-only/i);
  assert.match(probe, /VISION_OK/);
  assert.match(probe, /VISION_UNSUPPORTED/);
  assert.match(probe, /colorful square with a dark X\/border/);
  assert.match(probe, /Do not read real design screenshots/);
  assert.match(probe, /one\s+exact\s+token/i);
});

test('Claude Code reference gates image reads behind the vision probe', () => {
  const claude = readSkill('references/claude.md');

  assert.match(claude, /## Vision input probe/);
  assert.match(claude, /before using `Read` on image files, run the vision probe/);
  assert.match(claude, /Treat only an exact final response of `VISION_OK` as image support/);
  assert.match(claude, /do not call `Read` on PNG\/JPG\/WebP files/);
  assert.match(claude, /do not call\s+`preview_screenshot`/);
  assert.match(claude, /confirm the HTTP URL\s+loads/);
  assert.match(claude, /main container has non-zero width\/height/);
  assert.match(claude, /explicit note that image input is supported/);
});

test('generic verification instructions no longer require visual image input', () => {
  const systemPrompt = readSkill('system-prompt.md');
  const verifier = readSkill('agents/fork-verifier-agent.md');

  assert.match(systemPrompt, /Share a screenshot only when.*capability probe/);
  assert.match(systemPrompt, /do not read screenshots back into the model/);
  assert.match(verifier, /Skip screenshot\s+reads only when the caller explicitly says image input is unsupported/);
});

test('vision probe uses a committed PNG asset, not a hardcoded /tmp write', () => {
  const png = fs.readFileSync(path.join(SKILL_DIR, 'agents/assets/vision-probe.png'));
  assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.ok(png.length > 0);

  const claude = readSkill('references/claude.md');
  const probe = readSkill('agents/vision-probe-agent.md');

  assert.match(claude, /agents\/assets\/vision-probe\.png/);
  assert.match(probe, /agents\/assets\/vision-probe\.png/);
  assert.doesNotMatch(claude, /\/tmp\/baoyu-design-vision-probe\.png/);
  assert.doesNotMatch(claude, /writeFileSync/);
  assert.doesNotMatch(probe, /\/tmp\/baoyu-design-vision-probe\.png/);
});

test('vision probe verdict is probed once per session and cached', () => {
  const claude = readSkill('references/claude.md');

  assert.match(claude, /once per session/i);
  assert.match(claude, /cache\s+the verdict/i);
});
