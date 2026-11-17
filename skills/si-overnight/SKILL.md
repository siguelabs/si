---
name: si-overnight
description: Prepare and execute unattended overnight coding work. Interview the user before they leave, choose a fixed queue or scoped improvement discovery, implement and test, checkpoint progress, and leave a morning report. Use when the user asks to keep working while they sleep or invokes si-overnight.
---

# SI Overnight

Turn the user's available agent time into finished, verified project work while
they are away. Use the user's language for questions, checkpoints, and reports.

This skill supplies a workflow, not a background process. It cannot keep a
computer awake, restart an agent, create new turns after the host stops, bypass
approvals, or extend a provider quota. Explain relevant limitations once before
the user leaves. Use the host's existing execution facilities; do not silently
install a supervisor, schedule jobs, or weaken permission settings. For setup or
invocation differences, read [references/platforms.md](references/platforms.md).

## 1. Inspect before interviewing

Read applicable project instructions and inspect the current workspace, existing
changes, task context, build scripts, test setup, and available tools. Identify
likely blockers without reading secret values. Do not start implementation yet.
Check whether a previous overnight run is being resumed before creating a new one.

Ask only consequential questions that inspection and the current conversation do
not answer. Batch them so the user can answer before sleeping. Use the host's
question tool when available, otherwise a concise numbered message.

For **every new overnight run**, explicitly ask which mode to use, unless the
user has already chosen for this run:

- **Queue:** Finish the agreed primary tasks, then the agreed backup tasks, then
  stop. Do not invent additional implementation work.
- **Discover:** Finish the primary tasks, then find and implement useful
  improvements within agreed project areas, categories, and exclusions.

Neither mode is a permanent preference. Do not silently inherit last night's
mode. On a resume, retain this run's mode and ask only about material changes.

Resolve the following in the same interview, reusing explicit answers:

- Primary outcomes, priority, and observable acceptance criteria. Offer concrete
  candidates from the project if the user has not supplied tasks.
- Backup tasks for Queue; allowed areas and kinds of improvement for Discover.
  Ask whether dependency changes or broad refactors are included when relevant.
- Paths, behavior, APIs, data, or design decisions that must remain unchanged.
- A stop time with date and timezone, or a duration; any known spend/token cap.
  Offer a bounded duration if the user has no preference. Do not invent a cap.
- The expected checks and available test environment. Identify missing credentials,
  services, network access, dependencies, and anticipated permission prompts now.
- Delivery expectations and permissions that matter for these tasks: local edits,
  commits, push/PR, deployments, migrations, or external services. Propose local
  edits and a report for unspecified delivery. Reuse existing authorization.

In Discover mode, propose a concrete discovery boundary, such as bug fixes,
regression tests, and small accessibility improvements in named directories.
"Use all my tokens" expresses willingness to work; it does not define a project
scope. Do not accept unbounded unrelated work as a substitute for scope.

If questions are pending, continue useful read-only preparation. Do not treat
silence, elapsed time, or the user going offline as an answer. If a question only
affects an optional branch, defer that branch and proceed with independently
authorized work. A bare invocation with no actionable scope must stay in intake.

## 2. Save the run contract and start

Use [references/run-template.md](references/run-template.md) to create a compact
`.si-overnight/<unique-run-id>/run.md` in the target project. Use a timestamp plus
a collision suffix if needed. Preserve existing runs. Record the workspace,
baseline changes, chosen mode, exact scope, user answers, authorization, deadline,
acceptance criteria, task order, test plan, and next action. Never save credentials.

Show a short resolved plan and begin as soon as the necessary answers are in.
The user's answers are the go-ahead for the agreed work; do not add a ceremonial
"may I start?" round. If the user explicitly says wait, wait.

Before they leave, run proportionate baseline checks and a representative command
that exercises the expected permissions. Surface concrete setup blockers while
they can still answer. Do not promise that preflight prevents all future prompts.
Preserve existing user edits; use an isolated branch/worktree when appropriate
and supported, checking that its environment works. Never reset or stash user
changes merely to obtain a clean tree.

Keep the run files local and exclude them from staging unless the user asks to
version them. Do not change repository ignore/configuration files just to hide
these artifacts. If checkpoints cannot be written, disclose the limitation and
use an available approved persistent location; do not claim durable recovery.

## 3. Execute without requiring a conversation

Repeat while useful authorized work and budget remain:

1. Read the checkpoint and check the current time, scope, and available budget.
   Reserve enough remaining time for verification and a handoff. If the host
   exposes reliable usage telemetry, use it; otherwise report quota as unknown.
2. Select the highest-priority unblocked task. Keep tasks small enough to verify
   independently. Resolve ordinary implementation choices using the contract
   and project conventions instead of asking the absent user.
3. Implement the change and add meaningful regression coverage where warranted.
   Use bounded, noninteractive commands; avoid watch modes, interactive prompts,
   and commands that wait indefinitely. Stop only processes started by this run.
4. Run focused checks, fix demonstrated regressions, and run the broader checks
   required by the project or the acceptance criteria. Distinguish baseline
   failures from new failures and unavailable checks from passing checks.
5. Review the resulting diff for correctness, scope, and unrelated changes.
   Record the evidence and next action before moving to the next task.

Use available subagents for independent work when it helps; assign nonoverlapping
write ownership and verify their outputs. Do not assume every host supports them.
The same scope, deadline, and permissions apply to every worker.

Do not end with "I can continue if you want" while authorized work remains.
Continue within the active execution until completion, a stop condition, or a
host limit. A progress message is not a handoff requiring the user to reply.

In **Queue** mode, consume only the approved primary and backup queues.
In **Discover** mode, inspect for evidence-backed candidates after the primary
queue, rank by user impact and confidence, and implement one bounded improvement
at a time. Record each candidate's evidence, fit with the agreed scope, and
acceptance check before editing. Prefer reproducible bugs, missing regression
coverage, and improvements with observable benefit over speculative rewrites.
If no worthwhile candidate remains, stop and report that fact.

Run tests to obtain evidence, not to spend tokens. Do not disable tests, loosen
assertions, hide diagnostics, or change product requirements to manufacture a
pass. Do not repeatedly rerun unchanged passing checks without a new reason.

## 4. Handle surprises and stop conditions

When a task needs a new consequential decision, unavailable access, or an action
outside the contract, record the precise blocker and continue independent
authorized work. If a runtime approval is required, follow the host's approval
mechanism; prior agreement does not override it. Do not block the entire queue
on an optional deployment or credential-dependent integration.

Permission to discover improvements does not add permission to publish, deploy,
send messages, spend money, access new sensitive data, or alter unrelated projects.
Perform such actions only with applicable explicit authorization and host approval.
Never weaken sandboxing, permissions, tests, or security controls to keep running.

After three failed attempts on the same blocker without meaningful new evidence,
checkpoint it and move to another task. Retry transient failures only with bounded
backoff inside the remaining budget; do not wait indefinitely for quota resets.

Stop when any of these holds:

- The chosen queue is complete, or scoped discovery has no worthwhile work left.
- The agreed deadline or an observable budget/provider limit is reached.
- All remaining work depends on unavailable access, approval, or a user decision.
- The user asks to stop, or the host ends execution.

Checkpoint after every completed task, material failed attempt, permission blocker,
and before a risky operation or context handoff. Include work in progress and its
verification state. On foreseeable shutdown or quota exhaustion, save the report
if possible. A sudden termination may leave only the last checkpoint; never
promise an after-the-fact report from a stopped process.

## 5. Resume and leave the morning report

On resume, read the contract, checkpoint, current instructions, workspace diff,
and recent changes before acting. Reconcile the files with the recorded state;
do not assume an interrupted command succeeded. Check for other actors' edits.
Do not redo completed work or silently expand scope. If the deadline has expired,
write a handoff and obtain a new execution window before more implementation.
If a new approval is needed, preserve progress and identify the affected task.

Write `.si-overnight/<run-id>/report.md` in the user's language and give a short
chat handoff linking it. Report:

- Completed outcomes and their acceptance evidence.
- Changed files and any commits/PRs actually created under the agreed permissions.
- Exact check commands, observed outcomes, and checks that could not run.
- Incomplete work, blockers, assumptions, and any unverified changes.
- Why execution stopped, remaining useful work, and one concrete resume prompt
  naming this run's `run.md`.

Mark completion only when the relevant acceptance criteria are satisfied. Leave
blocked or unverified work clearly identified. Never claim all available tokens
were consumed without reliable measurement.
