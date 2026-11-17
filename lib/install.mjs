import {
  lstatSync, mkdirSync, readdirSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync,
} from 'node:fs';
import { randomBytes } from 'node:crypto';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SKILL_SOURCE = fileURLToPath(new URL('../skills/si-overnight/', import.meta.url));
// Shared with scripts/install.py so both installers use the same destinations.
export const HOSTS = JSON.parse(readFileSync(new URL('./hosts.json', import.meta.url), 'utf8'));
// File manager metadata must not make an identical copy look edited.
const IGNORED = new Set(['.DS_Store', 'Thumbs.db', 'desktop.ini']);

function inspect(path) {
  try {
    return lstatSync(path);
  } catch (error) {
    if (error.code === 'ENOENT') return undefined;
    throw error;
  }
}

function within(root, path) {
  const suffix = relative(root, path);
  return suffix === '' || (!isAbsolute(suffix) && suffix !== '..' && !suffix.startsWith(`..${sep}`));
}

function existingDirectory(path, label) {
  let real;
  try {
    real = realpathSync(resolve(path));
  } catch (error) {
    if (error.code === 'ENOENT') throw new Error(`${label} not found: ${resolve(path)}`);
    throw error;
  }
  if (!lstatSync(real).isDirectory()) throw new Error(`${label} is not a directory: ${real}`);
  return real;
}

function snapshot(directory) {
  const result = new Map();
  const visit = (path, name) => {
    const stat = inspect(path);
    if (!stat || stat.isSymbolicLink()) throw new Error(`Missing path or symbolic link: ${path}`);
    if (stat.isDirectory()) {
      result.set(name, null);
      for (const child of readdirSync(path).sort()) {
        if (!IGNORED.has(child)) visit(join(path, child), join(name, child));
      }
    } else if (stat.isFile()) {
      result.set(name, readFileSync(path));
    } else {
      throw new Error(`Expected a regular file or directory: ${path}`);
    }
  };
  visit(directory, '');
  return result;
}

function equalSnapshots(first, second) {
  if (first.size !== second.size) return false;
  for (const [name, content] of first) {
    if (!second.has(name)) return false;
    const other = second.get(name);
    if (content === null ? other !== null : other === null || !content.equals(other)) return false;
  }
  return true;
}

function checkParents(root, destination) {
  if (!within(root, destination) || destination === root) throw new Error('Destination must be inside the selected root.');
  let path = root;
  const pieces = relative(root, destination).split(sep);
  for (const piece of pieces) {
    path = join(path, piece);
    const stat = inspect(path);
    if (!stat) continue;
    if (stat.isSymbolicLink() || !stat.isDirectory()) {
      throw new Error(`Refusing a symbolic link or non-directory in destination path: ${path}`);
    }
  }
}

function ensureParents(root, destination) {
  let path = root;
  for (const piece of relative(root, dirname(destination)).split(sep)) {
    path = join(path, piece);
    try {
      mkdirSync(path);
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
    const stat = lstatSync(path);
    if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error(`Unsafe destination parent: ${path}`);
  }
}

// Backups live beside the skills directory, where hosts do not load them as skills.
function backupDirectory(destination) {
  return join(dirname(dirname(destination)), 'si-overnight-backups');
}

function backupPath(root, destination) {
  const directory = backupDirectory(destination);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  ensureParents(root, join(directory, 'placeholder'));
  for (let index = 0; ; index += 1) {
    const path = join(directory, index === 0 ? `si-overnight-${stamp}` : `si-overnight-${stamp}-${index}`);
    if (!inspect(path)) return path;
  }
}

// Build a complete copy beside the destination so a failure never leaves a partial install.
function stage(root, destination, expected) {
  checkParents(root, destination);
  ensureParents(root, destination);
  const staging = join(dirname(destination), `.si-overnight-${randomBytes(6).toString('hex')}`);
  mkdirSync(staging);
  try {
    for (const [name, content] of expected) {
      if (name === '') continue;
      const path = join(staging, name);
      if (content === null) mkdirSync(path);
      else writeFileSync(path, content, { flag: 'wx', mode: 0o644 });
    }
  } catch (error) {
    rmSync(staging, { recursive: true, force: true });
    throw error;
  }
  return staging;
}

function install(root, destination, expected) {
  const staging = stage(root, destination, expected);
  try {
    renameSync(staging, destination);
  } catch (error) {
    rmSync(staging, { recursive: true, force: true });
    throw error;
  }
}

function replace(root, destination, expected) {
  const staging = stage(root, destination, expected);
  let backup;
  try {
    backup = backupPath(root, destination);
    renameSync(destination, backup);
  } catch (error) {
    rmSync(staging, { recursive: true, force: true });
    throw error;
  }
  try {
    renameSync(staging, destination);
  } catch (error) {
    renameSync(backup, destination);
    rmSync(staging, { recursive: true, force: true });
    throw error;
  }
  return backup;
}

export function installationTargets({ platforms, scope = 'project', project = process.cwd(), userHome = homedir() }) {
  if (!Array.isArray(platforms) || platforms.length === 0) throw new Error('--platform is required.');
  for (const platform of platforms) {
    if (platform !== 'all' && !Object.hasOwn(HOSTS, platform)) throw new Error(`Unknown platform: ${platform}`);
  }
  if (scope !== 'project' && scope !== 'user') throw new Error('--scope must be project or user.');
  const root = scope === 'project'
    ? existingDirectory(project, 'Project directory')
    : existingDirectory(userHome, 'Home directory');
  const names = platforms.includes('all') ? Object.keys(HOSTS) : platforms;
  return {
    root,
    destinations: [...new Set(names.map((name) => join(root, HOSTS[name][scope], 'si-overnight')))],
  };
}

// Validate every destination before anything is written and report its state:
// missing, current (identical copy), or different (older version or local edits).
export function planInstall({
  platforms, scope = 'project', project = process.cwd(), userHome = homedir(), source = SKILL_SOURCE,
} = {}) {
  const { root, destinations } = installationTargets({ platforms, scope, project, userHome });
  const sourcePath = resolve(source);
  const expected = snapshot(sourcePath);
  if (!Buffer.isBuffer(expected.get('SKILL.md'))) throw new Error(`Missing source SKILL.md: ${sourcePath}`);
  const canonicalSource = realpathSync(sourcePath);
  const plan = destinations.map((destination) => {
    if (within(canonicalSource, destination) || within(destination, canonicalSource)) {
      throw new Error(`Source and destination overlap: ${destination}`);
    }
    checkParents(root, destination);
    if (!inspect(destination)) return { destination, state: 'missing' };
    return { destination, state: equalSnapshots(expected, snapshot(destination)) ? 'current' : 'different' };
  });
  return { root, expected, plan };
}

export function installSkill({
  platforms, scope = 'project', project = process.cwd(), userHome = homedir(),
  dryRun = false, update = false, source = SKILL_SOURCE, log = console.log,
} = {}) {
  const { root, expected, plan } = planInstall({ platforms, scope, project, userHome, source });
  const different = plan.filter(({ state }) => state === 'different');
  if (different.length > 0 && !update) {
    throw new Error(`Existing destination differs; nothing overwritten: ${different.map(({ destination }) => destination).join(', ')}\n`
      + 'Rerun with --update to replace it. The current copy is moved to a backup first.');
  }
  for (const { destination } of different) checkParents(root, backupDirectory(destination));

  for (const { destination, state } of plan) {
    if (state === 'current') {
      log(`Already installed: ${destination}`);
    } else if (dryRun) {
      log(`${state === 'missing' ? 'Would install' : 'Would update'}: ${destination}`);
    } else if (state === 'missing') {
      install(root, destination, expected);
      log(`Installed: ${destination}`);
    } else {
      const backup = replace(root, destination, expected);
      log(`Updated: ${destination}\n  Previous copy saved to: ${backup}`);
    }
  }
  return plan.map(({ destination }) => destination);
}
