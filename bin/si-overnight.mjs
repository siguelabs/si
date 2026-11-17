#!/usr/bin/env node

import { parseArgs } from 'node:util';
import { installSkill } from '../lib/install.mjs';

const help = `Usage: si-overnight --platform <name> [options]

Install the si-overnight skill. No agent process or background job is started.

Options:
  --platform <name>  codex, claude, antigravity, pi, or all (repeatable)
  --scope <scope>    project (default) or user
  --project <path>   Existing target project directory (default: current directory)
  --dry-run         Show destinations without writing files
  --help, -h        Show this help

Examples:
  si-overnight --platform all --project /path/to/project
  si-overnight --platform codex --scope user
  si-overnight --platform claude --platform pi --dry-run
`;

try {
  const { values } = parseArgs({
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
    process.stdout.write(help);
  } else {
    installSkill({
      platforms: values.platform,
      scope: values.scope,
      project: values.project,
      dryRun: values['dry-run'],
    });
  }
} catch (error) {
  console.error(`Install failed: ${error.message}`);
  process.exitCode = 1;
}
