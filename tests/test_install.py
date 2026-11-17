"""Verify installation destinations, repeatability, and preservation of user files."""

import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch


spec = importlib.util.spec_from_file_location(
    "install_skill", Path(__file__).resolve().parents[1] / "scripts" / "install.py"
)
installer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(installer)


class InstallTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)

    def test_all_project_hosts_install_complete_skill_without_duplicates(self):
        destinations = installer.targets(["all"], "project", self.root)
        self.assertEqual(len(destinations), 3)
        installer.install(destinations)
        expected = installer.manifest(installer.SOURCE)
        for destination in destinations:
            self.assertEqual(installer.manifest(destination), expected)

    def test_user_scope_paths_are_independent_of_current_project(self):
        user_home = self.root / "fake-user"
        expected = {
            user_home / ".agents/skills/si-overnight",
            user_home / ".claude/skills/si-overnight",
            user_home / ".gemini/config/skills/si-overnight",
            user_home / ".pi/agent/skills/si-overnight",
        }
        self.assertEqual(
            set(installer.targets(["all"], "user", self.root, user_home)), expected
        )

    def test_dry_run_does_not_create_directories(self):
        installer.install(installer.targets(["all"], "project", self.root), True)
        self.assertEqual(list(self.root.iterdir()), [])

    def test_reinstall_is_idempotent(self):
        destinations = installer.targets(["codex"], "project", self.root)
        installer.install(destinations)
        marker = destinations[0] / "SKILL.md"
        before = marker.stat().st_mtime_ns
        installer.install(destinations)
        self.assertEqual(marker.stat().st_mtime_ns, before)

    def test_conflict_preserves_user_edits_and_prevents_other_installs(self):
        destinations = installer.targets(["all"], "project", self.root)
        conflict = destinations[-1]
        conflict.mkdir(parents=True)
        marker = conflict / "SKILL.md"
        marker.write_text("user's existing skill")
        with self.assertRaises(ValueError):
            installer.install(destinations)
        self.assertEqual(marker.read_text(), "user's existing skill")
        self.assertFalse(destinations[0].exists())

    def test_existing_symlink_is_preserved(self):
        destination = self.root / "si-overnight"
        destination.symlink_to(self.root / "missing")
        with self.assertRaises(ValueError):
            installer.install([destination])
        self.assertTrue(destination.is_symlink())

    def test_missing_source_fails_without_writing(self):
        with patch.object(installer, "SOURCE", self.root / "missing"):
            with self.assertRaises(ValueError):
                installer.install([self.root / "destination"])
        self.assertEqual(list(self.root.iterdir()), [])

    def test_linked_parent_components_cannot_redirect_any_project_host(self):
        for platform, component in [
            ("codex", ".agents"), ("antigravity", ".agents/skills"),
            ("claude", ".claude"), ("claude", ".claude/skills"),
            ("pi", ".pi"), ("pi", ".pi/skills"),
        ]:
            with self.subTest(platform=platform, component=component):
                project = self.root / f"project-{platform}-{component.replace('/', '-')}"
                outside = self.root / f"outside-{platform}-{component.replace('/', '-')}"
                project.mkdir()
                outside.mkdir()
                link = project / component
                link.parent.mkdir(parents=True, exist_ok=True)
                link.symlink_to(outside, target_is_directory=True)
                with self.assertRaisesRegex(ValueError, "symbolic link"):
                    installer.install(installer.targets([platform], "project", project))
                self.assertEqual(list(outside.iterdir()), [])
                self.assertTrue(link.is_symlink())

    def test_relative_and_dangling_parent_links_are_rejected_in_dry_run(self):
        (self.root / "outside").mkdir()
        for index, target in enumerate(["../outside", "../missing"]):
            with self.subTest(target=target):
                project = self.root / f"relative-{index}"
                project.mkdir()
                (project / ".agents").symlink_to(target, target_is_directory=True)
                with self.assertRaisesRegex(ValueError, "symbolic link"):
                    installer.install(
                        installer.targets(["codex"], "project", project), dry_run=True
                    )
                self.assertEqual(list(project.iterdir()), [project / ".agents"])

    def test_late_linked_target_prevents_earlier_all_platform_writes(self):
        outside = self.root / "outside"
        outside.mkdir()
        (self.root / ".pi").symlink_to(outside, target_is_directory=True)
        with self.assertRaisesRegex(ValueError, "symbolic link"):
            installer.install(installer.targets(["all"], "project", self.root))
        self.assertFalse((self.root / ".agents").exists())
        self.assertFalse((self.root / ".claude").exists())
        self.assertEqual(list(outside.iterdir()), [])

    def test_selected_project_root_alias_remains_supported(self):
        project = self.root / "actual"
        project.mkdir()
        alias = self.root / "alias"
        alias.symlink_to(project, target_is_directory=True)
        destinations = installer.targets(["pi"], "project", alias)
        installer.install(destinations)
        self.assertTrue((project / ".pi/skills/si-overnight/SKILL.md").is_file())

    def test_user_scope_linked_parent_is_also_rejected(self):
        user_home = self.root / "fake-user"
        outside = self.root / "outside"
        user_home.mkdir()
        outside.mkdir()
        (user_home / ".gemini").symlink_to(outside, target_is_directory=True)
        with self.assertRaisesRegex(ValueError, "symbolic link"):
            installer.install(installer.targets(["all"], "user", self.root, user_home))
        self.assertFalse((user_home / ".agents").exists())
        self.assertEqual(list(outside.iterdir()), [])


if __name__ == "__main__":
    unittest.main()
