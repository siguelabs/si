import { createInterface } from 'node:readline';
import { parseArgs } from 'node:util';
import { installationTargets, installSkill } from './install.mjs';

const HOSTS = [
  { name: 'codex', label: 'Codex', command: '$si-overnight' },
  { name: 'claude', label: 'Claude Code', command: '/si-overnight' },
  { name: 'antigravity', label: 'Antigravity', command: '/si-overnight' },
  { name: 'pi', label: 'pi', command: '/skill:si-overnight' },
];

const help = `Usage: npx si-overnight [install] [options]

Run without options for guided setup. Choose your coding agent, then install for
all projects in your user account (default) or just the current project.
Installation does not start an agent or a background job.

Options (skip guided setup):
  --platform <name>  codex, claude, antigravity, pi, or all (repeatable; required)
  --scope <scope>    project (default with options) or user
  --project <path>   Existing target project directory (default: current directory)
  --dry-run         Show destinations without writing files
  --help, -h        Show this help

Examples:
  npx si-overnight
  npx si-overnight install
  npx si-overnight --platform all --scope user
  npx si-overnight --platform codex --project /path/to/project
  npx si-overnight --platform claude --platform pi --dry-run
`;

function invocationGuidance(output, platforms) {
  output.write('\nReady. Open or restart your coding agent in your project, then enter:\n');
  for (const host of HOSTS) {
    if (platforms.includes('all') || platforms.includes(host.name)) {
      output.write(`  ${host.label}: ${host.command}\n`);
    }
  }
}

function hostChoice(answer) {
  const choices = new Map(HOSTS.flatMap((host, index) => [
    [String(index + 1), host.name], [host.name, host.name], [host.label.toLowerCase(), host.name],
  ]));
  choices.set('5', 'all');
  choices.set('all', 'all');
  return choices.get(answer);
}

async function guidedOptions({ input, promptOutput, project, userHome }) {
  // RTK and other command wrappers can pipe stdout while stdin remains a terminal.
  if (!input.isTTY || input.readableEnded || input.destroyed) {
    throw new Error('Guided setup needs an interactive terminal. Run npx si-overnight in your terminal, or use: npx si-overnight --platform all --scope user');
  }

  const lines = createInterface({
    input, output: promptOutput, terminal: Boolean(promptOutput.isTTY), crlfDelay: Infinity,
  });
  // Attach the iterator before prompting so pasted answers cannot be lost.
  const answers = lines[Symbol.asyncIterator]();
  let closed = false;
  lines.once('close', () => { closed = true; });
  lines.once('SIGINT', () => lines.close());
  const question = async (prompt) => {
    promptOutput.write(prompt);
    const answer = await answers.next();
    if (answer.done || closed) return undefined;
    const value = answer.value.trim().toLowerCase();
    return ['q', 'quit', 'cancel', 'exit', '\u0003'].includes(value) ? undefined : value;
  };
  const cancel = () => {
    promptOutput.write('\nSetup cancelled. No files were written.\n');
    return undefined;
  };

  try {
    promptOutput.write('si-overnight setup\n\nChoose your coding agent:\n');
    HOSTS.forEach((host, index) => promptOutput.write(`  ${index + 1}. ${host.label}\n`));
    promptOutput.write('  5. All\n');
    const host = await question('Choose 1-5 (or q to cancel): ');
    if (host === undefined || host === '') return cancel();
    const platform = hostChoice(host);
    if (!platform) throw new Error('Invalid coding agent. Choose 1-5 or a listed name. No files were written.');

    promptOutput.write('\nWhere should the skill be available?\n  1. All projects (your user account; default)\n');
    promptOutput.write(`  2. Current project (${project})\n`);
    const scopeAnswer = await question('Choose 1-2 [1] (or q to cancel): ');
    if (scopeAnswer === undefined) return cancel();
    let scope;
    if (['', '1', 'user', 'all', 'all projects'].includes(scopeAnswer)) scope = 'user';
    if (['2', 'project', 'current', 'current project'].includes(scopeAnswer)) scope = 'project';
    if (!scope) throw new Error('Invalid install location. Choose 1 or 2. No files were written.');

    const options = { platforms: [platform], scope, project, userHome };
    const { destinations } = installationTargets(options);
    promptOutput.write('\nInstall locations:\n');
    for (const destination of destinations) promptOutput.write(`  ${destination}\n`);
    promptOutput.write('\nInstalling...\n');
    return options;
  } finally {
    lines.close();
  }
}

export async function runCli(args, {
  input = process.stdin, output = process.stdout, error = process.stderr,
  project = process.cwd(), userHome,
} = {}) {
  try {
    const optionsArgs = args[0] === 'install' ? args.slice(1) : args;
    let options;
    if (optionsArgs.length === 0) {
      options = await guidedOptions({ input, promptOutput: error, project, userHome });
      if (!options) return 0;
    } else {
      const { values } = parseArgs({
        args: optionsArgs,
        options: {
          platform: { type: 'string', multiple: true },
          scope: { type: 'string', default: 'project' },
          project: { type: 'string' },
          'dry-run': { type: 'boolean', default: false },
          help: { type: 'boolean', short: 'h' },
        },
        strict: true,
        allowPositionals: false,
      });
      if (values.help) {
        output.write(help);
        return 0;
      }
      options = {
        platforms: values.platform, scope: values.scope, project: values.project ?? project,
        userHome, dryRun: values['dry-run'],
      };
    }
    installSkill({ ...options, log: (message) => output.write(`${message}\n`) });
    if (!options.dryRun) invocationGuidance(output, options.platforms);
    return 0;
  } catch (cause) {
    error.write(`Install failed: ${cause.message}\n`);
    return 1;
  }
}
