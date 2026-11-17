import { createInterface } from 'node:readline';
import { parseArgs } from 'node:util';
import { HOSTS as HOST_TABLE, installSkill, planInstall } from './install.mjs';

const HOSTS = Object.entries(HOST_TABLE).map(([name, host]) => ({ name, ...host }));
const ALL_CHOICE = String(HOSTS.length + 1);

const help = `Usage: npx si-overnight [install] [options]

Run without options for guided setup. Choose your coding agent, then install for
all projects in your user account (default) or just the current project.
Installation does not start an agent or a background job.

Options (skip guided setup):
  --platform <name>  codex, claude, antigravity, pi, or all (repeatable; required)
  --scope <scope>    project (default with options) or user
  --project <path>   Existing target project directory for project scope
                     (default: current directory)
  --update           Replace a different existing copy; it is backed up first
  --dry-run          Show destinations without writing files
  --help, -h         Show this help

Examples:
  npx si-overnight
  npx si-overnight install
  npx si-overnight --platform all --scope user
  npx si-overnight --platform all --scope user --update
  npx si-overnight --platform codex --project /path/to/project
  npx si-overnight --platform claude --platform pi --dry-run
`;

function invocationGuidance(output, platforms, scope) {
  const where = scope === 'user' ? 'any of your projects' : 'the project';
  output.write(`\nReady. Open or restart your coding agent in ${where}, then enter:\n`);
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
  choices.set(ALL_CHOICE, 'all');
  choices.set('all', 'all');
  return choices.get(answer);
}

function scopeChoice(answer) {
  if (['', '1', 'user', 'all', 'all projects'].includes(answer)) return 'user';
  if (['2', 'project', 'current', 'current project'].includes(answer)) return 'project';
  return undefined;
}

function yesNo(answer) {
  if (['', 'n', 'no'].includes(answer)) return false;
  if (['y', 'yes'].includes(answer)) return true;
  return undefined;
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
  // Re-ask after an invalid answer; undefined means the user cancelled or input closed.
  const ask = async (prompt, parse, invalid) => {
    for (;;) {
      const answer = await question(prompt);
      if (answer === undefined) return undefined;
      const value = parse(answer);
      if (value !== undefined) return value;
      promptOutput.write(`${invalid}\n`);
    }
  };
  const cancel = () => {
    promptOutput.write('\nSetup cancelled. No files were written.\n');
    return undefined;
  };

  try {
    promptOutput.write('si-overnight setup\n\nChoose your coding agent:\n');
    HOSTS.forEach((host, index) => promptOutput.write(`  ${index + 1}. ${host.label}\n`));
    promptOutput.write(`  ${ALL_CHOICE}. All\n`);
    const platform = await ask(
      `Choose 1-${ALL_CHOICE} (or q to cancel): `, hostChoice,
      `Invalid coding agent. Choose 1-${ALL_CHOICE} or a listed name.`,
    );
    if (platform === undefined) return cancel();

    promptOutput.write('\nWhere should the skill be available?\n  1. All projects (your user account; default)\n');
    promptOutput.write(`  2. Current project (${project})\n`);
    const scope = await ask('Choose 1-2 [1] (or q to cancel): ', scopeChoice, 'Invalid install location. Choose 1 or 2.');
    if (scope === undefined) return cancel();

    const options = { platforms: [platform], scope, project, userHome };
    const { plan } = planInstall(options);
    const different = plan.filter(({ state }) => state === 'different');
    if (different.length > 0) {
      promptOutput.write('\nA different copy already exists (an older version or local edits):\n');
      for (const { destination } of different) promptOutput.write(`  ${destination}\n`);
      const replace = await ask('Replace it? The current copy is backed up first. [y/N]: ', yesNo, 'Answer y or n.');
      if (!replace) return cancel();
      options.update = true;
    }
    promptOutput.write('\nInstall locations:\n');
    for (const { destination } of plan) promptOutput.write(`  ${destination}\n`);
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
          update: { type: 'boolean', default: false },
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
      if (values.project !== undefined && values.scope === 'user') {
        throw new Error('--project applies only to --scope project.');
      }
      options = {
        platforms: values.platform, scope: values.scope, project: values.project ?? project,
        userHome, dryRun: values['dry-run'], update: values.update,
      };
    }
    installSkill({ ...options, log: (message) => output.write(`${message}\n`) });
    if (!options.dryRun) invocationGuidance(output, options.platforms, options.scope);
    return 0;
  } catch (cause) {
    error.write(`Install failed: ${cause.message}\n`);
    return 1;
  }
}
