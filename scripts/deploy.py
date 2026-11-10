#!/usr/bin/env python3
"""Receive a build on stdin, install it, switch links, and recover on failure.

Installed root-owned at /usr/local/libexec/nest-deploy.py; runs as ubuntu.
Uses only Python's standard library. It never opens the application's env file.
"""

import contextlib
import fcntl
import gzip
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import signal
import subprocess
import sys
import tarfile
import tempfile
import time
import uuid


RELEASE_ID = re.compile(r"[a-zA-Z0-9-]{1,128}\Z")
READY_MARKER = ".nest-release-ready"
REQUIRED_FILES = frozenset(("backend/dist/main.js", "backend/package.json",
                            "backend/package-lock.json", "frontend/dist/index.html"))
MAX_ARCHIVE_BYTES = 512 * 1024 * 1024
MAX_EXPANDED_BYTES = 1024 * 1024 * 1024
MAX_MEMBERS = 100000
CHUNK_SIZE = 1024 * 1024


class DeploymentError(Exception):
    pass


def log(message):
    try:
        print("[nest-deploy] " + message, flush=True)
    except OSError:
        # Losing an SSH log pipe must never prevent switching or recovery.
        # Replace the descriptor too, so interpreter shutdown cannot flush it again.
        try:
            descriptor = os.open(os.devnull, os.O_WRONLY)
            try:
                os.dup2(descriptor, sys.stdout.fileno())
            finally:
                os.close(descriptor)
        except (OSError, ValueError):
            pass


def positive_setting(name, default, maximum):
    try:
        value = int(os.environ.get(name, str(default)))
    except ValueError as error:
        raise DeploymentError("invalid " + name) from error
    if not 1 <= value <= maximum:
        raise DeploymentError("invalid " + name)
    return value


class Deployment:
    def __init__(self):
        self.root = Path(os.environ.get("NEST_DEPLOY_ROOT", "/srv/nest")).absolute()
        self.env_file = Path(os.environ.get(
            "NEST_DEPLOY_ENV_FILE", "/home/ubuntu/apps/nest/backend/.env")).absolute()
        self.health_url = os.environ.get("NEST_DEPLOY_HEALTH_URL", "http://127.0.0.1:3000/api/public/stats")
        self.site_url = os.environ.get("NEST_DEPLOY_SITE_URL", "")
        self.attempts = positive_setting("NEST_DEPLOY_HEALTH_ATTEMPTS", 15, 120)
        self.archive_limit = positive_setting("NEST_DEPLOY_MAX_ARCHIVE_BYTES", MAX_ARCHIVE_BYTES, MAX_ARCHIVE_BYTES)
        self.expanded_limit = positive_setting("NEST_DEPLOY_MAX_EXPANDED_BYTES", MAX_EXPANDED_BYTES, MAX_EXPANDED_BYTES)
        try:
            self.health_delay = float(os.environ.get("NEST_DEPLOY_HEALTH_DELAY", "2"))
        except ValueError as error:
            raise DeploymentError("invalid NEST_DEPLOY_HEALTH_DELAY") from error
        if not 0 <= self.health_delay <= 60:
            raise DeploymentError("invalid NEST_DEPLOY_HEALTH_DELAY")
        self.releases = self.root / "releases"

    @contextlib.contextmanager
    def lock(self):
        self.root.mkdir(parents=True, exist_ok=True)
        if self.root.is_symlink():
            raise DeploymentError("deployment root cannot be a symlink")
        self.root.chmod(0o755)
        descriptor = os.open(self.root / ".deploy.lock", os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
        with os.fdopen(descriptor, "r+") as lock_file:
            try:
                fcntl.flock(lock_file, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError as error:
                raise DeploymentError("another deployment holds the lock") from error
            self.releases.mkdir(exist_ok=True)
            if self.releases.is_symlink():
                raise DeploymentError("releases directory cannot be a symlink")
            self.releases.chmod(0o755)
            yield

    def release_path(self, release):
        path = self.releases / release
        if path.is_symlink() or path.resolve() != self.releases.resolve() / release:
            raise DeploymentError("release must be a directory inside this deployment root")
        return path

    def ready_release(self, release):
        path = self.release_path(release)
        marker = path / READY_MARKER
        if not path.is_dir() or marker.is_symlink() or not marker.is_file():
            raise DeploymentError("release is not successfully installed: " + release)
        if marker.stat().st_size > 129 or marker.read_text() != release + "\n":
            raise DeploymentError("invalid release completion marker: " + release)
        for required in REQUIRED_FILES:
            file = path / required
            if file.is_symlink() or not file.is_file() or not file.resolve().is_relative_to(path.resolve()):
                raise DeploymentError("release is incomplete: " + release)
        env_link = path / "backend/.env"
        if not env_link.is_symlink() or os.readlink(env_link) != str(self.env_file):
            raise DeploymentError("release is missing its external env link: " + release)
        return path

    def current_release(self):
        link = self.root / "current"
        if not os.path.lexists(link):
            return None
        if not link.is_symlink():
            raise DeploymentError("current must be a release symlink")
        target = link.resolve()
        release = target.name
        if not RELEASE_ID.fullmatch(release) or target.parent != self.releases.resolve():
            raise DeploymentError("current points outside this deployment root")
        self.ready_release(release)
        return release

    def set_link(self, name, release):
        target = self.root / name
        if release is None:
            target.unlink(missing_ok=True)
            return
        temporary = self.root / ("." + name + "-" + uuid.uuid4().hex)
        try:
            temporary.symlink_to("releases/" + release, target_is_directory=True)
            os.replace(temporary, target)
        finally:
            temporary.unlink(missing_ok=True)

    @staticmethod
    def copy_bounded(source, destination, limit, description):
        copied = 0
        while True:
            chunk = source.read(min(CHUNK_SIZE, limit - copied + 1))
            if not chunk:
                return
            copied += len(chunk)
            if copied > limit:
                raise DeploymentError(description + " exceeds size limit")
            destination.write(chunk)

    @staticmethod
    def member_path(member):
        name = member.name
        while name.startswith("./"):
            name = name[2:]
        name = name.rstrip("/")
        parts = name.split("/")
        if (not name or name.startswith("/") or "\\" in name or len(name) > 4096
                or any(ord(character) < 32 or ord(character) == 127 for character in name)
                or any(not part or part in (".", "..") or part.startswith(".") for part in parts)):
            raise DeploymentError("archive contains an unsafe path")
        if not (member.isfile() or member.isdir()):
            raise DeploymentError("archive contains a link or special file")
        if member.sparse is not None:
            raise DeploymentError("archive contains a sparse file")
        path = PurePosixPath(*parts)
        in_dist = len(parts) >= 2 and parts[0] in ("backend", "frontend") and parts[1] == "dist"
        package = name in ("backend/package.json", "backend/package-lock.json")
        allowed_directory = member.isdir() and (name in ("backend", "frontend") or in_dist)
        allowed_file = member.isfile() and ((in_dist and len(parts) > 2) or package)
        if not (allowed_directory or allowed_file):
            raise DeploymentError("archive contains a path outside the build whitelist")
        if member.size < 0 or (member.isdir() and member.size != 0):
            raise DeploymentError("archive contains an invalid member size")
        return path

    def unpack(self, source, stage):
        with tempfile.TemporaryFile() as compressed, tempfile.TemporaryFile() as expanded:
            log("receiving bounded gzip archive")
            self.copy_bounded(source, compressed, self.archive_limit, "compressed archive")
            compressed.seek(0)
            with gzip.GzipFile(fileobj=compressed, mode="rb") as zipped:
                self.copy_bounded(zipped, expanded, self.expanded_limit, "expanded archive")
            expanded.seek(0)
            with tarfile.open(fileobj=expanded, mode="r:") as bundle:
                members = []
                paths = set()
                files = set()
                total_size = 0
                for member in bundle:
                    if len(members) >= MAX_MEMBERS:
                        raise DeploymentError("archive has too many members")
                    path = self.member_path(member)
                    total_size += member.size
                    if total_size > self.expanded_limit:
                        raise DeploymentError("archive member sizes exceed expanded size limit")
                    if path in paths:
                        raise DeploymentError("archive contains duplicate paths")
                    paths.add(path)
                    if member.isfile():
                        files.add(path)
                    members.append((member, path))
                if not REQUIRED_FILES.issubset({str(path) for path in files}):
                    raise DeploymentError("archive is missing required build files")
                if any(parent in files for path in paths for parent in path.parents):
                    raise DeploymentError("archive file conflicts with a directory")
                # No tarfile extraction API is used: all paths and types are checked first.
                for member, path in members:
                    destination = stage.joinpath(*path.parts)
                    if member.isdir():
                        destination.mkdir(parents=True, exist_ok=True)
                    else:
                        destination.parent.mkdir(parents=True, exist_ok=True)
                        with bundle.extractfile(member) as content, destination.open("xb") as output:
                            shutil.copyfileobj(content, output, CHUNK_SIZE)
                        destination.chmod(0o644)

    @staticmethod
    def make_frontend_readable(stage):
        stage.chmod(0o755)
        for directory, subdirectories, files in os.walk(stage / "frontend"):
            Path(directory).chmod(0o755)
            for file in files:
                (Path(directory) / file).chmod(0o644)

    def restart_and_check(self):
        log("restarting nest-backend.service")
        subprocess.run(["sudo", "-n", "/usr/bin/systemctl", "restart", "nest-backend.service"],
                       check=True, timeout=90)
        for attempt in range(1, self.attempts + 1):
            log("health check " + str(attempt) + "/" + str(self.attempts))
            healthy = True
            for url in (self.health_url, self.site_url):
                if not url:
                    continue
                result = subprocess.run(
                    ["curl", "--fail", "--silent", "--show-error", "--connect-timeout", "3",
                     "--max-time", "5", url], stdout=subprocess.DEVNULL, timeout=10)
                if result.returncode != 0:
                    healthy = False
                    break
            if healthy:
                return
            if attempt < self.attempts:
                time.sleep(self.health_delay)
        raise DeploymentError("health check failed")

    def recover(self, old_release):
        log("restoring previous current release" if old_release else "removing failed initial current link")
        self.set_link("current", old_release)
        if old_release:
            try:
                self.restart_and_check()
                log("previous release recovered: " + old_release)
            except Exception as error:
                raise DeploymentError("previous current link restored, but recovery health failed") from error

    def deploy(self, release, source):
        final = self.release_path(release)
        if os.path.lexists(final):
            raise DeploymentError("release id already exists: " + release)
        old_release = self.current_release()
        if not self.env_file.is_file():
            raise DeploymentError("external application env file is missing")
        stage = Path(tempfile.mkdtemp(prefix=".staging-" + release + "-", dir=self.root))
        switched = False
        promoted = False
        succeeded = False
        try:
            self.unpack(source, stage)
            (stage / "backend/.env").symlink_to(self.env_file)
            log("installing production dependencies for " + release)
            subprocess.run(["npm", "ci", "--omit=dev"], cwd=stage / "backend", check=True, timeout=900)
            self.make_frontend_readable(stage)
            os.replace(stage, final)
            promoted = True
            log("switching current to " + release)
            self.set_link("current", release)
            switched = True
            self.restart_and_check()
            (final / READY_MARKER).write_text(release + "\n")
            self.set_link("previous", old_release)
            succeeded = True
            log("deployment succeeded: " + release)
        except (Exception, KeyboardInterrupt):
            if switched:
                self.recover(old_release)
            raise
        finally:
            # Failed candidates never become manual rollback targets.
            if not succeeded:
                if promoted:
                    if (self.root / "current").resolve() == final.resolve():
                        # Preserve files rather than leave a dangling current if link recovery failed.
                        (final / READY_MARKER).unlink(missing_ok=True)
                        log("candidate retained for repair because current still points to it")
                    else:
                        shutil.rmtree(final)
                elif stage.exists():
                    shutil.rmtree(stage)

    def rollback(self, release):
        self.ready_release(release)
        old_release = self.current_release()
        if old_release == release:
            log("requested release is already current: " + release)
            self.restart_and_check()
            return
        log("rolling back to " + release)
        self.set_link("current", release)
        try:
            self.restart_and_check()
            self.set_link("previous", old_release)
        except (Exception, KeyboardInterrupt):
            self.recover(old_release)
            raise
        log("rollback succeeded: " + release)


def main(arguments):
    if len(arguments) != 2 or arguments[0] not in ("deploy", "rollback") or not RELEASE_ID.fullmatch(arguments[1]):
        print("usage: nest-deploy.py deploy|rollback RELEASE_ID", file=sys.stderr)
        return 64
    try:
        def interrupted(signum, frame):
            raise DeploymentError("interrupted by signal " + str(signum))

        for signum in (signal.SIGTERM, signal.SIGHUP):
            signal.signal(signum, interrupted)
        deployment = Deployment()
        with deployment.lock():
            if arguments[0] == "deploy":
                deployment.deploy(arguments[1], sys.stdin.buffer)
            else:
                deployment.rollback(arguments[1])
        return 0
    except (DeploymentError, OSError, EOFError, tarfile.TarError, subprocess.SubprocessError) as error:
        # Avoid printing environment values or command output that might contain credentials.
        print("[nest-deploy] failed: " + str(error), file=sys.stderr)
        return 1
    except KeyboardInterrupt:
        print("[nest-deploy] interrupted", file=sys.stderr)
        return 130


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
