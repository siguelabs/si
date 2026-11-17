#!/usr/bin/env python3
"""Install the portable skill without changing host permissions or existing skills."""

import argparse
from pathlib import Path
import shutil
import sys


SOURCE = Path(__file__).resolve().parents[1] / "skills" / "si-overnight"
PROJECT_PATHS = {
    "codex": ".agents/skills",
    "claude": ".claude/skills",
    "antigravity": ".agents/skills",
    "pi": ".pi/skills",
}
USER_PATHS = {
    "codex": ".agents/skills",
    "claude": ".claude/skills",
    "antigravity": ".gemini/config/skills",
    "pi": ".pi/agent/skills",
}


class InstallTargets(list):
    """Keep the selected root bound to its otherwise list-compatible paths."""

    def __init__(self, paths, base):
        super().__init__(paths)
        self.base = base


def targets(platforms, scope, project, user_home=None):
    names = list(PROJECT_PATHS) if "all" in platforms else platforms
    base = project.resolve() if scope == "project" else (user_home or Path.home())
    paths = PROJECT_PATHS if scope == "project" else USER_PATHS
    return InstallTargets(
        dict.fromkeys(base / paths[name] / SOURCE.name for name in names), base
    )


def check_destination(base, destination):
    """Reject pre-existing links below the explicitly selected root."""
    relative = destination.relative_to(base)
    if not relative.parts or ".." in relative.parts:
        raise ValueError(f"Destination must be inside the selected root: {destination}")
    # The selected root itself may be an intentional alias (e.g. macOS /var).
    current = base.resolve()
    for component in relative.parts:
        current /= component
        if current.is_symlink() or (current.exists() and not current.is_dir()):
            raise ValueError(f"Unsafe symbolic link or non-directory: {current}")


def manifest(directory):
    """Compare all files and directories, refusing links in an existing install."""
    if directory.is_symlink() or not directory.is_dir():
        return None
    result = {}
    for item in directory.rglob("*"):
        if item.is_symlink():
            return None
        if item.is_dir():
            result[str(item.relative_to(directory))] = None
        elif item.is_file():
            result[str(item.relative_to(directory))] = item.read_bytes()
        else:
            return None
    return result


def install(destinations, dry_run=False):
    if not (SOURCE / "SKILL.md").is_file():
        raise ValueError(f"Missing source skill: {SOURCE}")
    expected = manifest(SOURCE)
    if expected is None:
        raise ValueError("The source skill must be a regular directory without links.")
    pending = []
    base = getattr(destinations, "base", None)
    # Preflight every destination before writing any of them.
    for destination in destinations:
        if base is not None:
            check_destination(base, destination)
        if destination.exists() or destination.is_symlink():
            if manifest(destination) != expected:
                raise ValueError(
                    f"Existing destination differs; nothing overwritten: {destination}\n"
                    "Review and move the existing directory before reinstalling."
                )
        else:
            pending.append(destination)
    for destination in destinations:
        if destination not in pending:
            print(f"Already installed: {destination}")
        elif dry_run:
            print(f"Would install: {destination}")
        else:
            if base is not None:
                check_destination(base, destination)
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copytree(SOURCE, destination)
            print(f"Installed: {destination}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--platform", nargs="+", required=True,
        choices=[*PROJECT_PATHS, "all"],
    )
    parser.add_argument("--scope", choices=["project", "user"], default="project")
    parser.add_argument("--project", type=Path, default=Path.cwd())
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    try:
        install(targets(args.platform, args.scope, args.project), args.dry_run)
    except (OSError, ValueError) as error:
        print(f"Install failed: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
