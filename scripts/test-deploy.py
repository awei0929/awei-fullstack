#!/usr/bin/env python3
"""Isolated deployment behavior tests; never reads the project's real .env."""

import fcntl
import io
import json
import os
from pathlib import Path
import signal
import stat
import subprocess
import sys
import tarfile
import tempfile
import time
import unittest


SCRIPT_DIR = Path(__file__).resolve().parent
DEPLOY = SCRIPT_DIR / "deploy.py"
GATE = SCRIPT_DIR / "deploy-ssh.sh"


def archive(extra=(), missing=()):
    """A small, hand-written build fixture, with optional adversarial members."""
    files = {
        "backend/dist/main.js": b"console.log('fixture');\n",
        "backend/package.json": b'{"name":"fixture","version":"1.0.0"}\n',
        "backend/package-lock.json": b'{"name":"fixture","lockfileVersion":3}\n',
        "frontend/dist/index.html": b"<!doctype html><title>fixture</title>\n",
        "frontend/dist/assets/app.js": b"document.title = 'fixture';\n",
    }
    output = io.BytesIO()
    with tarfile.open(fileobj=output, mode="w:gz") as bundle:
        for name, data in files.items():
            if name in missing:
                continue
            member = tarfile.TarInfo(name)
            member.size = len(data)
            member.mode = 0o644
            bundle.addfile(member, io.BytesIO(data))
        for member, data in extra:
            bundle.addfile(member, io.BytesIO(data) if data is not None else None)
    return output.getvalue()


FAKE_COMMAND = r'''import json
import os
from pathlib import Path
import sys
import time

state = Path(os.environ["NEST_DEPLOY_TEST_STATE"])
root = Path(os.environ["NEST_DEPLOY_ROOT"])
command = Path(sys.argv[0]).name
current = (root / "current").resolve().name
with (state / "commands.jsonl").open("a") as log:
    log.write(json.dumps({"command": command, "args": sys.argv[1:],
                          "cwd": os.getcwd(), "current": current}) + "\n")
if command == "npm":
    if sys.argv[1:] != ["ci", "--omit=dev"]:
        sys.exit(90)
    if (state / "npm-fail").exists():
        sys.exit(17)
    if (state / "npm-block").exists():
        (state / "npm-entered").touch()
        while (state / "npm-block").exists():
            time.sleep(0.02)
    Path("node_modules").mkdir(exist_ok=True)
    Path("node_modules/fixture-installed").write_text("installed\n")
elif command == "sudo":
    if sys.argv[1:] != ["-n", "/usr/bin/systemctl", "restart", "nest-backend.service"]:
        sys.exit(91)
    if (state / ("fail-restart-" + current)).exists():
        sys.exit(18)
    if (state / ("restart-block-" + current)).exists():
        (state / "restart-entered").touch()
        while (state / ("restart-block-" + current)).exists():
            time.sleep(0.02)
elif command == "curl":
    if not all(flag in sys.argv for flag in ["--fail", "--silent", "--show-error"]):
        sys.exit(92)
    if sys.argv[-1] not in ("http://fixture.invalid/api/public/stats", "https://fixture.invalid/"):
        sys.exit(93)
    if (state / ("curl-block-" + current)).exists():
        (state / "curl-entered").touch()
        while (state / ("curl-block-" + current)).exists():
            time.sleep(0.02)
    failure = "fail-site-" if sys.argv[-1] == "https://fixture.invalid/" else "fail-health-"
    if (state / (failure + current)).exists():
        sys.exit(22)
else:
    sys.exit(94)
'''


class DeployBehaviorTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="nest-deploy-test-")
        self.addCleanup(self.temporary.cleanup)
        self.base = Path(self.temporary.name)
        self.root = self.base / "deploy-root"
        self.state = self.base / "fake-state"
        self.state.mkdir()
        self.bin = self.base / "bin"
        self.bin.mkdir()
        self.env_file = self.base / "fixture.env"
        self.env_file.write_text("LOCAL_FIXTURE_ONLY=1\n")
        for command in ("npm", "sudo", "curl"):
            executable = self.bin / command
            executable.write_text("#!" + sys.executable + "\n" + FAKE_COMMAND)
            executable.chmod(0o755)
        self.env = {key: value for key, value in os.environ.items()
                    if not key.startswith("NEST_DEPLOY_")}
        self.env.update({
            "PATH": str(self.bin) + os.pathsep + os.environ.get("PATH", ""),
            "NEST_DEPLOY_ROOT": str(self.root),
            "NEST_DEPLOY_ENV_FILE": str(self.env_file),
            "NEST_DEPLOY_HEALTH_URL": "http://fixture.invalid/api/public/stats",
            "NEST_DEPLOY_SITE_URL": "",
            "NEST_DEPLOY_HEALTH_ATTEMPTS": "2",
            "NEST_DEPLOY_HEALTH_DELAY": "0",
            "NEST_DEPLOY_TEST_STATE": str(self.state),
        })

    def run_deploy(self, release="first", data=None, action="deploy", **config):
        environment = dict(self.env, **config)
        return subprocess.run(
            [sys.executable, str(DEPLOY), action, release],
            input=archive() if data is None and action == "deploy" else data,
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=environment, timeout=15,
        )

    def assert_ok(self, result):
        self.assertEqual(result.returncode, 0,
                         (result.stdout + result.stderr).decode(errors="replace"))

    def commands(self):
        log = self.state / "commands.jsonl"
        return [json.loads(line) for line in log.read_text().splitlines()] if log.exists() else []

    def current(self):
        return (self.root / "current").resolve().name

    def test_success_installs_before_atomic_switch_and_preserves_env(self):
        self.assert_ok(self.run_deploy())
        release = self.root / "releases/first"
        self.assertEqual(os.readlink(self.root / "current"), "releases/first")
        self.assertFalse((self.root / "previous").exists())
        self.assertEqual((release / "frontend/dist/index.html").read_text(),
                         "<!doctype html><title>fixture</title>\n")
        self.assertEqual(os.readlink(release / "backend/.env"), str(self.env_file))
        self.assertEqual(self.env_file.read_text(), "LOCAL_FIXTURE_ONLY=1\n")
        self.assertEqual((release / ".nest-release-ready").read_text(), "first\n")
        self.assertTrue((release / "backend/node_modules/fixture-installed").is_file())
        events = self.commands()
        self.assertEqual([event["command"] for event in events], ["npm", "sudo", "curl"])
        self.assertNotEqual(events[0]["current"], "first")
        self.assertEqual(Path(events[0]["cwd"]).name, "backend")
        self.assertEqual([event["current"] for event in events[1:]], ["first", "first"])

    def test_second_success_keeps_old_release_and_previous(self):
        self.assert_ok(self.run_deploy("one"))
        self.assert_ok(self.run_deploy("two"))
        self.assertEqual(self.current(), "two")
        self.assertEqual(os.readlink(self.root / "previous"), "releases/one")
        self.assertTrue((self.root / "releases/one/.nest-release-ready").is_file())

    def test_promoted_frontend_is_readable_under_restrictive_umask(self):
        previous_umask = os.umask(0o077)
        try:
            self.assert_ok(self.run_deploy())
        finally:
            os.umask(previous_umask)
        release = self.root / "releases/first"
        for relative in (".", "frontend", "frontend/dist", "frontend/dist/assets"):
            with self.subTest(directory=relative):
                self.assertEqual(stat.S_IMODE((release / relative).stat().st_mode), 0o755)
        for relative in ("frontend/dist/index.html", "frontend/dist/assets/app.js"):
            self.assertEqual(stat.S_IMODE((release / relative).stat().st_mode), 0o644)

    def test_site_health_failure_rolls_back_even_when_api_is_healthy(self):
        self.env["NEST_DEPLOY_SITE_URL"] = "https://fixture.invalid/"
        self.assert_ok(self.run_deploy("one"))
        (self.state / "fail-site-broken").touch()
        before = len(self.commands())
        result = self.run_deploy("broken")
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(self.current(), "one")
        self.assertFalse((self.root / "releases/broken").exists())
        probes = [event for event in self.commands()[before:] if event["command"] == "curl"]
        self.assertEqual([event["args"][-1] for event in probes], [
            "http://fixture.invalid/api/public/stats", "https://fixture.invalid/",
            "http://fixture.invalid/api/public/stats", "https://fixture.invalid/",
            "http://fixture.invalid/api/public/stats", "https://fixture.invalid/",
        ])
        self.assertEqual(probes[-1]["current"], "one")

    def test_ssh_interruption_signals_restore_current_and_remove_candidate(self):
        self.assert_ok(self.run_deploy("one"))
        for interrupted in (signal.SIGTERM, signal.SIGHUP):
            with self.subTest(signal=interrupted):
                (self.state / "curl-entered").unlink(missing_ok=True)
                blocked = self.state / "curl-block-broken"
                blocked.touch()
                child = subprocess.Popen([sys.executable, str(DEPLOY), "deploy", "broken"],
                                         stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                         stderr=subprocess.PIPE, env=self.env)
                try:
                    child.stdin.write(archive())
                    child.stdin.close()
                    deadline = time.monotonic() + 5
                    while not (self.state / "curl-entered").exists() and time.monotonic() < deadline:
                        if child.poll() is not None:
                            break
                        time.sleep(0.02)
                    self.assertTrue((self.state / "curl-entered").exists())
                    child.send_signal(interrupted)
                    self.assertNotEqual(child.wait(timeout=5), 0)
                    self.assertEqual(self.current(), "one")
                    self.assertFalse((self.root / "releases/broken").exists())
                    self.assertEqual(self.commands()[-1]["current"], "one")
                finally:
                    blocked.unlink(missing_ok=True)
                    if child.poll() is None:
                        child.kill()
                        child.wait()
                    child.stdout.close()
                    child.stderr.close()

    def test_disconnected_log_pipe_never_leaves_current_dangling(self):
        self.assert_ok(self.run_deploy("one"))
        blocked = self.state / "restart-block-two"
        blocked.touch()
        child = subprocess.Popen([sys.executable, str(DEPLOY), "deploy", "two"],
                                 stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                 stderr=subprocess.PIPE, env=self.env)
        try:
            child.stdin.write(archive())
            child.stdin.close()
            deadline = time.monotonic() + 5
            while not (self.state / "restart-entered").exists() and time.monotonic() < deadline:
                if child.poll() is not None:
                    break
                time.sleep(0.02)
            self.assertTrue((self.state / "restart-entered").exists())
            child.stdout.close()
            blocked.unlink()
            self.assertEqual(child.wait(timeout=5), 0, child.stderr.read().decode())
            self.assertTrue((self.root / "current/.nest-release-ready").is_file())
            self.assertEqual(self.current(), "two")
            self.assertEqual(os.readlink(self.root / "previous"), "releases/one")
        finally:
            blocked.unlink(missing_ok=True)
            if child.poll() is None:
                child.kill()
                child.wait()
            child.stdout.close()
            child.stderr.close()

    def test_install_failure_does_not_switch_or_restart(self):
        self.assert_ok(self.run_deploy("one"))
        before = self.commands()
        (self.state / "npm-fail").touch()
        result = self.run_deploy("broken")
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(self.current(), "one")
        self.assertEqual([event["command"] for event in self.commands()[len(before):]], ["npm"])
        self.assertFalse((self.root / "releases/broken").exists())
        self.assertEqual(list(self.root.glob(".staging-*")), [])

    def test_failed_health_restores_current_restarts_and_exits_failure(self):
        self.assert_ok(self.run_deploy("one"))
        self.assert_ok(self.run_deploy("two"))
        before = len(self.commands())
        (self.state / "fail-health-broken").touch()
        result = self.run_deploy("broken")
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(self.current(), "two")
        self.assertEqual(os.readlink(self.root / "previous"), "releases/one")
        restarts = [event["current"] for event in self.commands()[before:]
                    if event["command"] == "sudo"]
        self.assertEqual(restarts, ["broken", "two"])
        self.assertEqual(self.commands()[-1]["command"], "curl")
        self.assertEqual(self.commands()[-1]["current"], "two")
        self.assertFalse((self.root / "releases/broken").exists())
        self.assertNotEqual(self.run_deploy("broken", action="rollback").returncode, 0)

    def test_restart_failure_restores_previous_running_release(self):
        self.assert_ok(self.run_deploy("one"))
        (self.state / "fail-restart-broken").touch()
        result = self.run_deploy("broken")
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(self.current(), "one")
        self.assertEqual(self.commands()[-1]["current"], "one")
        self.assertFalse((self.root / "releases/broken").exists())

    def test_failed_initial_release_leaves_no_current_or_rollback_target(self):
        (self.state / "fail-health-first").touch()
        result = self.run_deploy()
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse(os.path.lexists(self.root / "current"))
        self.assertFalse((self.root / "releases/first").exists())
        self.assertNotEqual(self.run_deploy("first", action="rollback").returncode, 0)

    def test_failed_recovery_preserves_old_link_and_rejects_candidate(self):
        self.assert_ok(self.run_deploy("one"))
        (self.state / "fail-health-one").touch()
        (self.state / "fail-health-broken").touch()
        result = self.run_deploy("broken")
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(self.current(), "one")
        self.assertTrue((self.root / "current/backend/dist/main.js").is_file())
        self.assertFalse((self.root / "releases/broken").exists())
        self.assertEqual(self.commands()[-1]["current"], "one")

    def test_manual_rollback_uses_installed_release_without_reinstall(self):
        self.assert_ok(self.run_deploy("one"))
        self.assert_ok(self.run_deploy("two"))
        before = len(self.commands())
        self.assert_ok(self.run_deploy("one", action="rollback"))
        self.assertEqual(self.current(), "one")
        self.assertEqual(os.readlink(self.root / "previous"), "releases/two")
        self.assertEqual([event["command"] for event in self.commands()[before:]], ["sudo", "curl"])

    def test_failed_manual_rollback_recovers_old_current(self):
        self.assert_ok(self.run_deploy("one"))
        self.assert_ok(self.run_deploy("two"))
        (self.state / "fail-health-one").touch()
        result = self.run_deploy("one", action="rollback")
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(self.current(), "two")
        self.assertEqual(os.readlink(self.root / "previous"), "releases/one")
        self.assertTrue((self.root / "releases/one/.nest-release-ready").is_file())

    def test_duplicate_release_is_rejected_without_changes(self):
        self.assert_ok(self.run_deploy("one"))
        before = self.commands()
        result = self.run_deploy("one")
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(self.commands(), before)
        self.assertEqual(self.current(), "one")

    def test_lock_rejects_another_process_before_installation(self):
        self.root.mkdir()
        with (self.root / ".deploy.lock").open("w") as lock:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            result = self.run_deploy()
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(self.commands(), [])
        self.assertFalse((self.root / "current").exists())

    def test_overlapping_publish_is_rejected_while_first_installs(self):
        blocked = self.state / "npm-block"
        blocked.touch()
        first = subprocess.Popen([sys.executable, str(DEPLOY), "deploy", "one"],
                                 stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                 stderr=subprocess.PIPE, env=self.env)
        try:
            first.stdin.write(archive())
            first.stdin.close()
            deadline = time.monotonic() + 5
            while not (self.state / "npm-entered").exists() and time.monotonic() < deadline:
                if first.poll() is not None:
                    break
                time.sleep(0.02)
            self.assertTrue((self.state / "npm-entered").exists(), "first publish never reached install")
            result = self.run_deploy("two")
            self.assertNotEqual(result.returncode, 0)
            blocked.unlink()
            self.assertEqual(first.wait(timeout=5), 0, first.stderr.read().decode())
            self.assertEqual(self.current(), "one")
            self.assertFalse((self.root / "releases/two").exists())
        finally:
            blocked.unlink(missing_ok=True)
            if first.poll() is None:
                first.kill()
                first.wait()
            first.stdout.close()
            first.stderr.close()

    def test_archive_rejects_paths_links_special_files_and_duplicates(self):
        self.assert_ok(self.run_deploy("one"))
        bad_members = []
        for name in ("../escape", "/tmp/nest-forbidden-write", "backend/dist/../../escape",
                     ".env", "backend/.env", "backend/dist/.env", "README.md",
                     "frontend/dist/.git/config", "backend/dist/evil\\name.js"):
            member = tarfile.TarInfo(name)
            member.size = 1
            bad_members.append((member, b"x"))
        for kind in (tarfile.SYMTYPE, tarfile.LNKTYPE, tarfile.FIFOTYPE, tarfile.CHRTYPE):
            member = tarfile.TarInfo("backend/dist/evil")
            member.type = kind
            member.linkname = "../../escape"
            bad_members.append((member, None))
        duplicate = tarfile.TarInfo("backend/dist/main.js")
        duplicate.size = 1
        bad_members.append((duplicate, b"x"))
        for number, member in enumerate(bad_members):
            with self.subTest(name=member[0].name, kind=member[0].type):
                before = self.commands()
                result = self.run_deploy("bad-" + str(number), archive(extra=[member]))
                self.assertNotEqual(result.returncode, 0)
                self.assertEqual(self.current(), "one")
                self.assertEqual(self.commands(), before)
                self.assertFalse((self.base / "escape").exists())
                self.assertFalse((self.root / ("releases/bad-" + str(number))).exists())

    def test_archive_requires_complete_build_and_valid_gzip(self):
        for data in (b"not gzip", archive(missing=["frontend/dist/index.html"]),
                     archive(missing=["backend/dist/main.js"]),
                     archive(missing=["backend/package-lock.json"])):
            with self.subTest(data_length=len(data)):
                self.assertNotEqual(self.run_deploy(data=data).returncode, 0)
                self.assertFalse((self.root / "current").exists())
                self.assertEqual(self.commands(), [])

    def test_archive_accepts_explicit_build_and_parent_directories(self):
        directories = []
        for name in ("backend/", "backend/dist/", "frontend/", "frontend/dist/", "frontend/dist/assets/"):
            member = tarfile.TarInfo(name)
            member.type = tarfile.DIRTYPE
            directories.append((member, None))
        self.assert_ok(self.run_deploy(data=archive(extra=directories)))
        self.assertTrue((self.root / "current/frontend/dist/assets/app.js").is_file())

    def test_archive_size_limits_reject_before_installation(self):
        for config in ({"NEST_DEPLOY_MAX_ARCHIVE_BYTES": "64"},
                       {"NEST_DEPLOY_MAX_EXPANDED_BYTES": "16"}):
            with self.subTest(config=config):
                result = self.run_deploy(**config)
                self.assertNotEqual(result.returncode, 0)
                self.assertEqual(self.commands(), [])
                self.assertFalse((self.root / "current").exists())

    def test_sparse_tar_member_cannot_expand_beyond_archive_budget(self):
        sparse = tarfile.TarInfo("backend/dist/sparse")
        sparse.size = 1
        sparse.pax_headers = {"GNU.sparse.map": "0,1", "GNU.sparse.size": "65536"}
        result = self.run_deploy(data=archive(extra=[(sparse, b"x")]),
                                 NEST_DEPLOY_MAX_EXPANDED_BYTES="20480")
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(self.commands(), [])
        self.assertFalse((self.root / "current").exists())

    def test_invalid_release_and_actions_are_rejected(self):
        for release in ("", "../one", "a/b", "a b", "x;id", "x\n", "a" * 129):
            with self.subTest(release=release):
                self.assertNotEqual(self.run_deploy(release).returncode, 0)
        self.assertNotEqual(self.run_deploy("one", action="shell").returncode, 0)
        self.assertEqual(self.commands(), [])
        self.assertFalse(self.root.exists())

    def test_rollback_rejects_unfinished_external_and_symlink_releases(self):
        self.assert_ok(self.run_deploy("one"))
        unfinished = self.root / "releases/unfinished"
        unfinished.mkdir()
        external = self.base / "external"
        external.mkdir()
        (external / ".nest-release-ready").write_text("external\n")
        (self.root / "releases/external").symlink_to(external, target_is_directory=True)
        before = self.commands()
        for release in ("missing", "unfinished", "external", "../external"):
            with self.subTest(release=release):
                self.assertNotEqual(self.run_deploy(release, action="rollback").returncode, 0)
                self.assertEqual(self.current(), "one")
                self.assertEqual(self.commands(), before)

    def test_gate_rejects_shell_syntax_and_extra_arguments(self):
        commands = ("", "id", "deploy", "deploy ", "deploy ../bad", "deploy x; id",
                    "deploy x && id", "deploy x\nrollback y", "deploy x extra", "deploy x\t",
                    " deploy x", "rollback x ", "rollback $(id)", "deploy " + "x" * 129)
        for command in commands:
            with self.subTest(command=command):
                environment = dict(self.env, SSH_ORIGINAL_COMMAND=command)
                result = subprocess.run(["/bin/sh", str(GATE)], env=environment,
                                        stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=5)
                self.assertEqual(result.returncode, 64, result.stderr.decode(errors="replace"))
        self.assertEqual(self.commands(), [])
        self.assertFalse(self.root.exists())


if __name__ == "__main__":
    unittest.main(verbosity=2)
