import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync,
  realpathSync, rmSync, statSync, symlinkSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { PassThrough, Writable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { runCli } from '../lib/cli.mjs';
import { installationTargets, installSkill, SKILL_SOURCE } from '../lib/install.mjs';

const cli = fileURLToPath(new URL('../bin/si-overnight.mjs', import.meta.url));
const quiet = () => {};
function temporary(t) {
  const path = realpathSync(mkdtempSync(join(tmpdir(), 'si-overnight-node-')));
  t.after(() => rmSync(path, { recursive: true, force: true }));
  return path;
}
function run(args, cwd) {
  return spawnSync(process.execPath, [cli, ...args], { cwd, encoding: 'utf8', timeout: 10_000 });
}

async function guided(t, { args = [], answers = [], project, userHome } = {}) {
  const input = new PassThrough();
  input.isTTY = true;
  let stdout = '';
  let stderr = '';
  const output = new Writable({ write(chunk, encoding, done) { stdout += chunk; done(); } });
  const error = new Writable({
    write(chunk, encoding, done) {
      stderr += chunk;
      if (chunk.toString().startsWith('Choose 1-')) {
        const answer = answers.shift();
        queueMicrotask(() => {
          if (answer === undefined) input.end();
          else input.write(`${answer}\n`);
        });
      }
      done();
    },
  });
  t.after(() => input.destroy());
  const status = await runCli(args, { input, output, error, project, userHome });
  return { status, stdout, stderr };
}

test('CLI help succeeds without choosing a platform or creating files', (t) => {
  const project = temporary(t);
  const result = run(['--help'], project);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /--platform/);
  assert.deepEqual(readdirSync(project), []);
});

test('CLI rejects unknown and malformed explicit arguments without writes', (t) => {
  const project = temporary(t);
  for (const args of [['--dry-run'], ['--scope', 'user'], ['--platform', 'other'], ['--platform', 'codex', '--scope', 'system'], ['--surprise'], ['other']]) {
    const result = run(args, project);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Install failed:/);
  }
  assert.deepEqual(readdirSync(project), []);
});

test('no-argument and install commands explain noninteractive usage without waiting or writes', (t) => {
  const project = temporary(t);
  for (const args of [[], ['install']]) {
    const result = run(args, project);
    assert.equal(result.error, undefined);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /interactive terminal/);
    assert.match(result.stderr, /npx si-overnight --platform all --scope user/);
    assert.doesNotMatch(result.stdout, /Installed|Ready/);
  }
  assert.deepEqual(readdirSync(project), []);
});

test('guided setup uses user scope by default even when output is not a TTY', async (t) => {
  const root = temporary(t);
  const project = join(root, 'project');
  const userHome = join(root, 'home');
  mkdirSync(project);
  mkdirSync(userHome);
  const result = await guided(t, { answers: ['1', ''], project, userHome });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stderr, /1\. Codex/);
  assert.match(result.stderr, /2\. Claude Code/);
  assert.match(result.stderr, /3\. Antigravity/);
  assert.match(result.stderr, /4\. pi/);
  assert.match(result.stderr, /5\. All/);
  assert.match(result.stderr, /All projects \(your user account; default\)/);
  const destination = join(userHome, '.agents/skills/si-overnight');
  assert.ok(existsSync(join(destination, 'SKILL.md')));
  assert.ok(result.stderr.includes(destination));
  assert.ok(result.stderr.indexOf('Install locations:') < result.stderr.indexOf('Installing...'));
  assert.match(result.stdout, /Codex: \$si-overnight/);
  assert.doesNotMatch(result.stdout, /Claude Code:|Antigravity:|pi:/);
  assert.deepEqual(readdirSync(project), []);
});

test('guided install alias accepts named choices and installs all hosts in the current project', async (t) => {
  const root = temporary(t);
  const project = join(root, 'project');
  const userHome = join(root, 'home');
  mkdirSync(project);
  mkdirSync(userHome);
  const result = await guided(t, { args: ['install'], answers: ['All', 'Current project'], project, userHome });
  assert.equal(result.status, 0, result.stderr);
  const { destinations } = installationTargets({ platforms: ['all'], project });
  assert.equal(result.stdout.match(/Installed:/g).length, 3);
  for (const destination of destinations) assert.ok(existsSync(join(destination, 'SKILL.md')));
  assert.match(result.stdout, /Codex: \$si-overnight/);
  assert.match(result.stdout, /Claude Code: \/si-overnight/);
  assert.match(result.stdout, /Antigravity: \/si-overnight/);
  assert.match(result.stdout, /pi: \/skill:si-overnight/);
  assert.deepEqual(readdirSync(userHome), []);
});

test('guided setup supports every individual coding agent', async (t) => {
  const root = temporary(t);
  for (const [choice, platform, command] of [
    ['2', 'claude', 'Claude Code: /si-overnight'],
    ['Antigravity', 'antigravity', 'Antigravity: /si-overnight'],
    ['pi', 'pi', 'pi: /skill:si-overnight'],
  ]) {
    const project = join(root, platform);
    mkdirSync(project);
    const result = await guided(t, { answers: [choice, '2'], project });
    assert.equal(result.status, 0, result.stderr);
    const { destinations: [destination] } = installationTargets({ platforms: [platform], project });
    assert.ok(existsSync(join(destination, 'SKILL.md')));
    assert.ok(result.stdout.includes(command));
  }
});

test('cancelled, invalid, and closed guided input never writes files', async (t) => {
  const root = temporary(t);
  const project = join(root, 'project');
  const userHome = join(root, 'home');
  mkdirSync(project);
  mkdirSync(userHome);
  for (const answers of [[], [''], ['q'], ['\u0003'], ['1'], ['1', 'cancel'], ['1', '\u0003'], ['99'], ['1', '99']]) {
    const result = await guided(t, { answers: [...answers], project, userHome });
    assert.equal(result.status, answers.includes('99') ? 1 : 0, result.stderr);
    assert.match(result.stderr, /No files were written/);
    assert.doesNotMatch(result.stdout, /Installed|Ready/);
    assert.deepEqual(readdirSync(project), []);
    assert.deepEqual(readdirSync(userHome), []);
  }
});

test('guided setup preserves differing existing content through installer preflight', async (t) => {
  const project = temporary(t);
  const { destinations } = installationTargets({ platforms: ['all'], project });
  const conflict = destinations.at(-1);
  mkdirSync(conflict, { recursive: true });
  writeFileSync(join(conflict, 'SKILL.md'), 'User-owned version');
  const result = await guided(t, { answers: ['5', '2'], project });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Existing destination differs/);
  assert.doesNotMatch(result.stdout, /Ready/);
  assert.equal(readFileSync(join(conflict, 'SKILL.md'), 'utf8'), 'User-owned version');
  assert.equal(existsSync(destinations[0]), false);
});

test('install alias preserves explicit flag behavior and prints host invocation', (t) => {
  const project = temporary(t);
  const result = run(['install', '--platform', 'pi'], project);
  assert.equal(result.status, 0, result.stderr);
  assert.ok(existsSync(join(project, '.pi/skills/si-overnight/SKILL.md')));
  assert.match(result.stdout, /pi: \/skill:si-overnight/);
  assert.equal(result.stderr, '');
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
