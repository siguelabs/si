# Development and installation options

Start with the [quick guide](../README.md) or the [Turkish guide](tr/README.md).

## Install from a script or checkout

The Node installer requires Node.js 20 or newer. Pass a platform and scope when
running it from a script or CI.

```bash
npx --yes si-overnight --platform codex --scope user
npx --yes si-overnight --platform all --project /absolute/path/to/project
```

From a source checkout, use `node bin/si-overnight.mjs` with the same options.
The checkout also includes the Python installer.

```bash
python3 scripts/install.py --platform all --project /absolute/path/to/project
```

| Option | Meaning |
| --- | --- |
| `--platform` | `codex`, `claude`, `antigravity`, `pi`, or `all`. Repeat the flag to select multiple apps. |
| `--scope` | `project` by default when using flags, or `user` for all projects. |
| `--project` | Existing project folder. Defaults to the current directory and applies to project scope. |
| `--dry-run` | Show and validate the destinations without writing files. |
| `--help` | Show the CLI options and examples. |

`npx si-overnight install` also opens guided setup. The installer leaves
identical copies alone and protects different files from overwrites. To update
an existing copy with different contents, review and move it, then reinstall.

For install paths, permissions, and execution limits, see the
[platform guide](../skills/si-overnight/references/platforms.md). See the
[skill instructions](../skills/si-overnight/SKILL.md) for how the agent handles
scope, interruptions, tests, and saved progress.

## Test changes

Run these commands from the repository root.

```bash
npm test
python3 -m unittest discover -s tests -v
```

To check the actual npm package, run
`node .github/scripts/pack-smoke.mjs /path/to/an/empty/output-folder`. It packs
the project, installs from the archive offline, and checks the files.

To regenerate the workflow illustration, install Pillow and run
`python3 scripts/render_workflow.py`.

## Release to npm

Branch pushes and pull requests run the tests and build the `npm-package`
artifact. A stable tag such as `v0.1.3` must match the version in `package.json`.
The release workflow tests the tag and publishes the verified archive.

The npm package uses [Trusted Publishing](https://docs.npmjs.com/trusted-publishers/).
The authorized GitHub repository is `siguelabs/si`, the filename is `release.yml`,
and the environment field is empty. The connection must allow `npm publish`.

`package.json` declares `UNLICENSED`.
