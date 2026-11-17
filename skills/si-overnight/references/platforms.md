# Host compatibility

The same `SKILL.md` implements the workflow. Installation and invocation differ
by host. These paths and commands were checked against official documentation on
2026-11-17; installed versions and organization settings can differ.

| Host | Project skill directory | User skill directory | Invocation |
| --- | --- | --- | --- |
| Codex | `.agents/skills/si-overnight/` | `~/.agents/skills/si-overnight/` | `$si-overnight` or select via `/skills` |
| Claude Code | `.claude/skills/si-overnight/` | `~/.claude/skills/si-overnight/` | `/si-overnight` |
| Google Antigravity | `.agents/skills/si-overnight/` | `~/.gemini/config/skills/si-overnight/` | `/si-overnight` |
| pi | `.pi/skills/si-overnight/` | `~/.pi/agent/skills/si-overnight/` | `/skill:si-overnight` |

Each directory contains `SKILL.md` and its supporting files. Pi also supports
`.agents/skills` and `~/.agents/skills`. Antigravity retains legacy `.agent/skills`
compatibility; use the current path for new installations.

Do not promise a literal `/si-overnight` command on every platform. On other
Agent Skills-compatible hosts, use that host's documented discovery path and
invocation mechanism. If skills are unsupported but file reading and editing are
available, the user can explicitly ask the agent to read this `SKILL.md` and
follow it; native command registration is not implied.

## Execution lifetime

The user must leave a usable execution environment: the local machine, agent
process, session, and required services must remain available, or the host must
provide an actual remote execution environment. A checkpoint makes a later
resume possible; it does not trigger that resume.

An instruction-only skill does not provide an autonomous process supervisor.
Headless/print commands normally complete a request and exit. Re-launching them
requires a separate, explicitly configured runner with its own bounds and
permissions. This skill does not install one or automatically retry billing and
quota failures. Do not claim that a successful process exit proves tests passed.

Codex versions exposing Goal mode can support sustained work through `/goal`.
The user can explicitly start a goal containing the agreed overnight contract.
Do not assume that invoking this skill creates a native goal or schedule, or that
Goal mode removes quota, access, or environment limits.

Use supported host question/approval tools and preserve the user's configured
permission policy. Do not prescribe blanket permission bypass flags for unattended
execution. Anticipated access should be checked during the awake interview.

Sources:

- [Codex skills](https://learn.chatgpt.com/docs/build-skills)
- [Codex long-running work](https://learn.chatgpt.com/docs/long-running-work)
- [Claude Code skills](https://code.claude.com/docs/en/skills)
- [Claude Code headless execution](https://code.claude.com/docs/en/headless)
- [Antigravity skills](https://antigravity.google/docs/skills)
- [Antigravity workflow migration](https://antigravity.google/docs/migration/workflows-to-skills/)
- [Antigravity headless execution](https://antigravity.google/docs/cli/headless/)
- [pi skills](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/skills.md)
- [pi CLI](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/cli.md)
