# si-overnight

**English** · [Türkçe](https://github.com/siguelabs/si/blob/main/docs/tr/README.md)

Give your coding agent a few tasks before bed. It asks what it needs to know,
works and tests while you're away, and leaves you a report.

## Install

You'll need [Node.js 20 or newer](https://nodejs.org/en/download) and one of the
coding apps below. Run this command in your terminal.

```bash
npx si-overnight
```

If npm asks whether to install the package, press Enter to continue.

1. Pick your coding app. Choose **All** if you use more than one.
2. Pick **All projects** to use the skill across your projects, or **Current project** for the folder you're in.
3. Open your project in your coding app. In its chat, enter the command the installer shows you.

| Coding app | Command to enter in the app's chat |
| --- | --- |
| Codex | `$si-overnight` or pick `si-overnight` from `/skills` |
| Claude Code | `/si-overnight` |
| Google Antigravity | `/si-overnight` |
| pi | `/skill:si-overnight` |

## Use it tonight

Here's an example for Codex. Use your app's command on the first line.

```text
$si-overnight
Fix the bug where clicking Save twice creates two copies.
Ask me any questions before I leave. Work for up to two hours.
```

Before you go, the agent checks your project and asks about the tasks, what to
leave alone, and when to stop. You choose what it does after the main tasks.

- **Queue** works through the backup tasks you agreed on, then stops.
- **Discover** looks for useful fixes or improvements in the areas you allowed.

It works through the tasks, runs tests, and saves its progress. If your app
supports additional agents, it can give them separate tasks and check their work.

![Example of the overnight workflow](https://raw.githubusercontent.com/siguelabs/si/main/docs/assets/overnight-workflow.gif)

## Check what happened

Look in `.si-overnight/` inside your project. Each run has its own folder.

- `report.md` tells you what changed, which tests ran, and what's left.
- `run.md` saves the plan and progress. To resume, run the skill again and give it this file's path.

Keep your coding session running. If your computer sleeps or the app stops, you
can pick up from `run.md` when you return.

[Installation options, platform details, and development](https://github.com/siguelabs/si/blob/main/docs/development.md)
