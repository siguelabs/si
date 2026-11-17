import {
  lstatSync, mkdirSync, readdirSync, readFileSync, realpathSync, writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SKILL_SOURCE = fileURLToPath(new URL('../skills/si-overnight/', import.meta.url));
const PROJECT_PATHS = {
  codex: '.agents/skills',
  claude: '.claude/skills',
  antigravity: '.agents/skills',
  pi: '.pi/skills',
};
const USER_PATHS = {
  codex: '.agents/skills',
  claude: '.claude/skills',
  antigravity: '.gemini/config/skills',
  pi: '.pi/agent/skills',
};

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

function snapshot(directory) {
  const result = new Map();
  const visit = (path, name) => {
    const stat = inspect(path);
    if (!stat || stat.isSymbolicLink()) throw new Error(`Missing path or symbolic link: ${path}`);
    if (stat.isDirectory()) {
      result.set(name, null);
      for (const child of readdirSync(path).sort()) visit(join(path, child), join(name, child));
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

export function installationTargets({ platforms, scope = 'project', project = process.cwd(), userHome = homedir() }) {
  if (!Array.isArray(platforms) || platforms.length === 0) throw new Error('--platform is required.');
  for (const platform of platforms) {
    if (platform !== 'all' && !Object.hasOwn(PROJECT_PATHS, platform)) throw new Error(`Unknown platform: ${platform}`);
  }
  if (scope !== 'project' && scope !== 'user') throw new Error('--scope must be project or user.');
  const paths = scope === 'project' ? PROJECT_PATHS : USER_PATHS;
  const root = realpathSync(resolve(scope === 'project' ? project : userHome));
  if (!lstatSync(root).isDirectory()) throw new Error(`Selected root is not a directory: ${root}`);
  const names = platforms.includes('all') ? Object.keys(paths) : platforms;
  return { root, destinations: [...new Set(names.map((name) => join(root, paths[name], 'si-overnight')))] };
}

export function installSkill({
  platforms, scope = 'project', project = process.cwd(), userHome = homedir(),
  dryRun = false, source = SKILL_SOURCE, log = console.log,
} = {}) {
  const { root, destinations } = installationTargets({ platforms, scope, project, userHome });
  const sourcePath = resolve(source);
  const expected = snapshot(sourcePath);
  if (!Buffer.isBuffer(expected.get('SKILL.md'))) throw new Error(`Missing source SKILL.md: ${sourcePath}`);
  const canonicalSource = realpathSync(sourcePath);
  const pending = new Set();

  // Check every destination before creating anything, including shared host paths.
  for (const destination of destinations) {
    if (within(canonicalSource, destination) || within(destination, canonicalSource)) {
      throw new Error(`Source and destination overlap: ${destination}`);
    }
    checkParents(root, destination);
    if (inspect(destination)) {
      if (!equalSnapshots(expected, snapshot(destination))) {
        throw new Error(`Existing destination differs; nothing overwritten: ${destination}`);
      }
    } else {
      pending.add(destination);
    }
  }

  for (const destination of destinations) {
    if (!pending.has(destination)) {
      log(`Already installed: ${destination}`);
    } else if (dryRun) {
      log(`Would install: ${destination}`);
    } else {
      checkParents(root, destination);
      ensureParents(root, destination);
      // Exclusive mkdir/write prevents merging into or overwriting a destination.
      mkdirSync(destination);
      for (const [name, content] of expected) {
        if (name === '') continue;
        const path = join(destination, name);
        if (content === null) mkdirSync(path);
        else writeFileSync(path, content, { flag: 'wx', mode: 0o644 });
      }
      log(`Installed: ${destination}`);
    }
  }
  return destinations;
}
