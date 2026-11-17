#!/usr/bin/env python3
"""Install the portable skill without changing host permissions or existing skills."""

import argparse
import json
from pathlib import Path
import secrets
import shutil
import sys


REPOSITORY = Path(__file__).resolve().parents[1]
SOURCE = REPOSITORY / "skills" / "si-overnight"
# Shared with lib/install.mjs so both installers use the same destinations.
HOSTS = json.loads((REPOSITORY / "lib" / "hosts.json").read_text(encoding="utf-8"))
PROJECT_PATHS = {name: host["project"] for name, host in HOSTS.items()}
USER_PATHS = {name: host["user"] for name, host in HOSTS.items()}
# File manager metadata must not make an identical copy look edited.
IGNORED = {".DS_Store", "Thumbs.db", "desktop.ini"}


class InstallTargets(list):
    """Keep the selected root bound to its otherwise list-compatible paths."""

    def __init__(self, paths, base):
        super().__init__(paths)
        self.base = base


def existing_directory(path, label):
    if not path.is_dir():
        raise ValueError(f"{label} not found or not a directory: {path}")
    return path


def targets(platforms, scope, project, user_home=None):
    names = list(PROJECT_PATHS) if "all" in platforms else platforms
    if scope == "project":
        base = existing_directory(project, "Project directory").resolve()
    else:
        base = existing_directory(user_home or Path.home(), "Home directory")
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
        if item.name in IGNORED:
            continue
        if item.is_symlink():
            return None
        if item.is_dir():
            result[str(item.relative_to(directory))] = None
        elif item.is_file():
            result[str(item.relative_to(directory))] = item.read_bytes()
        else:
            return None
    return result


def copy_skill(destination):
    """Copy beside the destination, then rename, so a failure leaves no partial install."""
    destination.parent.mkdir(parents=True, exist_ok=True)
    staging = destination.parent / f".si-overnight-{secrets.token_hex(6)}"
    try:
        shutil.copytree(SOURCE, staging, ignore=shutil.ignore_patterns(*IGNORED))
        staging.rename(destination)
    except BaseException:
        shutil.rmtree(staging, ignore_errors=True)
        raise


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
                    "To replace it, run `npx si-overnight` with the same options plus "
                    "--update, or move the existing directory first."
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
            copy_skill(destination)
            print(f"Installed: {destination}")


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--platform", action="extend", nargs="+", required=True,
        choices=[*PROJECT_PATHS, "all"],
    )
    parser.add_argument("--scope", choices=["project", "user"], default="project")
    parser.add_argument("--project", type=Path)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args(argv)
    if args.project is not None and args.scope == "user":
        parser.error("--project applies only to --scope project.")
    try:
        install(
            targets(args.platform, args.scope, args.project or Path.cwd()), args.dry_run
        )
    except (OSError, ValueError) as error:
        print(f"Install failed: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
