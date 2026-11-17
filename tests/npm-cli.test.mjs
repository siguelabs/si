import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync,
  realpathSync, rmSync, statSync, symlinkSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { installationTargets, installSkill, SKILL_SOURCE } from '../lib/install.mjs';

const cli = fileURLToPath(new URL('../bin/si-overnight.mjs', import.meta.url));
const quiet = () => {};
function temporary(t) {
  const path = realpathSync(mkdtempSync(join(tmpdir(), 'si-overnight-node-')));
  t.after(() => rmSync(path, { recursive: true, force: true }));
  return path;
}
function run(args, cwd) {
  return spawnSync(process.execPath, [cli, ...args], { cwd, encoding: 'utf8' });
}

test('CLI help succeeds without choosing a platform or creating files', (t) => {
  const project = temporary(t);
  const result = run(['--help'], project);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /--platform/);
  assert.deepEqual(readdirSync(project), []);
});

test('CLI rejects missing, unknown, and malformed arguments without writes', (t) => {
  const project = temporary(t);
  for (const args of [[], ['--platform', 'other'], ['--platform', 'codex', '--scope', 'system'], ['--surprise']]) {
    const result = run(args, project);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Install failed:/);
  }
  assert.deepEqual(readdirSync(project), []);
});

test('all project hosts install one complete copy per distinct destination', (t) => {
  const project = temporary(t);
  const result = run(['--platform', 'all', '--project', project], project);
  assert.equal(result.status, 0, result.stderr);
  const { destinations } = installationTargets({ platforms: ['all'], project });
  assert.equal(destinations.length, 3);
  for (const destination of destinations) {
    assert.equal(readFileSync(join(destination, 'SKILL.md'), 'utf8'), readFileSync(join(SKILL_SOURCE, 'SKILL.md'), 'utf8'));
    assert.ok(existsSync(join(destination, 'references/run-template.md')));
    assert.ok(existsSync(join(destination, 'references/platforms.md')));
  }
});

test('user scope uses each host user directory without changing the project', (t) => {
  const root = temporary(t);
  const userHome = join(root, 'fake-user');
  const project = join(root, 'project');
  mkdirSync(userHome);
  mkdirSync(project);
  const destinations = installSkill({ platforms: ['all'], scope: 'user', project, userHome, log: quiet });
  assert.deepEqual(new Set(destinations), new Set([
    join(userHome, '.agents/skills/si-overnight'),
    join(userHome, '.claude/skills/si-overnight'),
    join(userHome, '.gemini/config/skills/si-overnight'),
    join(userHome, '.pi/agent/skills/si-overnight'),
  ]));
  for (const destination of destinations) assert.ok(existsSync(join(destination, 'SKILL.md')));
  assert.deepEqual(readdirSync(project), []);
});

test('CLI accepts repeated platforms and dry run performs no writes', (t) => {
  const project = temporary(t);
  const result = run(['--platform', 'claude', '--platform', 'pi', '--dry-run'], project);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.match(/Would install:/g).length, 2);
  assert.deepEqual(readdirSync(project), []);
});

test('identical reinstall preserves existing file times', (t) => {
  const project = temporary(t);
  const options = { platforms: ['codex'], project, log: quiet };
  const [destination] = installSkill(options);
  const file = join(destination, 'SKILL.md');
  const before = statSync(file).mtimeMs;
  installSkill(options);
  assert.equal(statSync(file).mtimeMs, before);
});

test('all destinations are preflighted before writes and user content is preserved', (t) => {
  const project = temporary(t);
  const { destinations } = installationTargets({ platforms: ['all'], project });
  const conflict = destinations.at(-1);
  mkdirSync(conflict, { recursive: true });
  writeFileSync(join(conflict, 'SKILL.md'), 'User-owned version');
  assert.throws(() => installSkill({ platforms: ['all'], project, log: quiet }), /Existing destination differs/);
  assert.equal(readFileSync(join(conflict, 'SKILL.md'), 'utf8'), 'User-owned version');
  assert.equal(existsSync(destinations[0]), false);
});

test('destination parent symlink cannot redirect a project install', (t) => {
  const root = temporary(t);
  const project = join(root, 'project');
  const outside = join(root, 'outside');
  mkdirSync(project);
  mkdirSync(outside);
  symlinkSync(outside, join(project, '.agents'), 'dir');
  assert.throws(() => installSkill({ platforms: ['codex'], project, log: quiet }), /symbolic link/);
  assert.deepEqual(readdirSync(outside), []);
  assert.equal(lstatSync(join(project, '.agents')).isSymbolicLink(), true);
});

test('dangling destination symlink is preserved and rejected', (t) => {
  const project = temporary(t);
  const { destinations: [destination] } = installationTargets({ platforms: ['codex'], project });
  mkdirSync(dirname(destination), { recursive: true });
  symlinkSync(join(project, 'missing'), destination, 'dir');
  assert.throws(() => installSkill({ platforms: ['codex'], project, log: quiet }), /symbolic link/);
  assert.equal(lstatSync(destination).isSymbolicLink(), true);
});

test('source symlinks and source/destination overlap fail without writes', (t) => {
  const project = temporary(t);
  const source = join(project, 'source');
  mkdirSync(source);
  writeFileSync(join(source, 'SKILL.md'), 'skill');
  symlinkSync(join(source, 'SKILL.md'), join(source, 'linked.md'));
  assert.throws(() => installSkill({ platforms: ['codex'], project, source, log: quiet }), /symbolic link/);
  assert.equal(existsSync(join(project, '.agents')), false);

  const overlappingProject = join(project, 'overlap');
  const overlappingSource = join(overlappingProject, '.agents/skills/si-overnight');
  mkdirSync(overlappingSource, { recursive: true });
  writeFileSync(join(overlappingSource, 'SKILL.md'), 'skill');
  assert.throws(() => installSkill({ platforms: ['codex'], project: overlappingProject, source: overlappingSource, log: quiet }), /overlap/);
  assert.deepEqual(readdirSync(overlappingSource), ['SKILL.md']);
});

test('explicit project root may be an existing directory alias', (t) => {
  const root = temporary(t);
  const actual = join(root, 'actual');
  mkdirSync(actual);
  const alias = join(root, 'alias');
  symlinkSync(actual, alias, 'dir');
  const [destination] = installSkill({ platforms: ['pi'], project: alias, log: quiet });
  assert.equal(destination, join(actual, '.pi/skills/si-overnight'));
  assert.ok(existsSync(join(destination, 'SKILL.md')));
});
