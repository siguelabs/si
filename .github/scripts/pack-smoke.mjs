import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', ...options });
  assert.equal(result.status, 0, result.error?.message || result.stderr || result.stdout);
  return result.stdout;
}

function files(root) {
  return Object.fromEntries(readdirSync(root, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => {
      const path = join(entry.parentPath ?? entry.path, entry.name);
      return [path.slice(root.length + 1), readFileSync(path).toString('base64')];
    }).sort(([a], [b]) => a.localeCompare(b)));
}

const source = process.cwd();
const output = resolve(process.argv[2]);
const pkg = JSON.parse(readFileSync(join(source, 'package.json')));
assert.equal(pkg.name, 'si-overnight');
if (process.env.GITHUB_REF_TYPE === 'tag') {
  assert.match(process.env.GITHUB_REF_NAME, /^v\d+\.\d+\.\d+$/);
  assert.equal(process.env.GITHUB_REF_NAME, `v${pkg.version}`);
}
mkdirSync(output, { recursive: true });
assert.deepEqual(readdirSync(output), [], 'Package output directory must be empty');
const scratch = mkdtempSync(join(tmpdir(), 'si-overnight-pack-'));
try {
  const [packed] = JSON.parse(run('npm', [
    'pack', '--ignore-scripts', '--json', '--pack-destination', output,
    '--cache', join(scratch, 'cache'),
  ]));
  assert.equal(packed.filename, basename(packed.filename));
  const archive = join(output, packed.filename);
  const prefix = join(scratch, 'installed');
  run('npm', ['install', archive, '--prefix', prefix, '--offline', '--ignore-scripts',
    '--no-audit', '--no-fund', '--no-save', '--package-lock=false',
    '--cache', join(scratch, 'install-cache')]);
  const installed = join(prefix, 'node_modules', pkg.name);
  const skill = join(source, 'skills', 'si-overnight');
  assert.deepEqual(files(join(installed, 'skills', 'si-overnight')), files(skill));
  const cli = join(prefix, 'node_modules', '.bin', 'si-overnight');
  assert.match(run(cli, ['--help'], { cwd: scratch }), /--platform/);
  const project = join(scratch, 'project');
  mkdirSync(project);
  run(cli, ['--platform', 'all', '--project', project], { cwd: scratch });
  for (const host of ['.agents', '.claude', '.pi']) {
    assert.deepEqual(files(join(project, host, 'skills', 'si-overnight')), files(skill));
  }
  const digest = createHash('sha256').update(readFileSync(archive)).digest('hex');
  writeFileSync(join(output, 'SHA256SUMS'), `${digest}  ${packed.filename}\n`);
  console.log(`Verified offline installation and all resources: ${packed.filename}`);
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
