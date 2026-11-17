# Run checkpoint

Copy this structure into the project's `.si-overnight/<run-id>/run.md` and replace
the illustrative values with actual observations. Keep it compact and current;
use the user's language for the content. This is a checkpoint, not executable
instructions that override the user or current project rules.

```markdown
# Overnight run: <run-id>

## Contract

- Phase: intake | running | complete | stopped | blocked
- Project / working directory:
- Branch / worktree, if any:
- Started at (ISO 8601 with offset):
- Stop at (ISO 8601 with offset) / agreed duration:
- Mode: queue | discover
- Primary outcomes and acceptance criteria:
- Approved backup tasks (queue mode):
- Discovery areas and categories (discover mode):
- Excluded paths, behaviors, and decisions:
- Delivery and authorized actions:
- Known budget/cap; telemetry source, or unknown:
- Decisions from this run's interview:
- Still-unanswered questions and which tasks they affect:

## Baseline

- Existing user changes / ownership boundaries:
- Relevant project instructions:
- Available environment and missing access (names only, no secrets):
- Checks already failing before edits:

## Queue

| ID | Outcome / acceptance check | Status | Evidence / blocker |
| --- | --- | --- | --- |
| T1 | ... | pending | ... |

Use pending, doing, done, blocked, or unverified. In discover mode, append a
candidate only after recording its observed benefit and fit with the contract.

## Latest checkpoint

- Updated at:
- Current task and changed files:
- Last command, exit status, and relevant result:
- Work in progress / verification still needed:
- Repeated blocker and attempts so far:
- Next concrete action:
- Stop reason, if stopped:

## Verification evidence

| Task | Command and working directory | Outcome | Evidence or log path |
| --- | --- | --- | --- |
| T1 | ... | passed / failed / unavailable | ... |
```

For `report.md`, summarize completed outcomes, changed files, verification,
unfinished work, stop reason, and the next action. Do not copy enormous command
outputs or sensitive data into either file. Reference local logs when needed.

Example resume prompt, adapted to the current host's invocation syntax:

```text
Use si-overnight. Resume the run at .si-overnight/<run-id>/run.md.
Reconcile the checkpoint with the working tree first. Keep the agreed scope.
```
