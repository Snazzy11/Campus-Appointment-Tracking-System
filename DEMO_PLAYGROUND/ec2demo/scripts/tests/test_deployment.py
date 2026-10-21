"""Exercise deployment failures with fake Docker/SSH; never contact EC2."""

import gzip
import hashlib
import importlib.util
import json
import os
import subprocess
import tempfile
import unittest
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("deploy", SCRIPTS / "deploy_ec2.py")
deploy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(deploy)

DOCKER = """#!/usr/bin/env python3
import sys, os, json
from pathlib import Path
args=sys.argv[1:]
with open(os.environ['TEST_LOG'],'a') as f: f.write(json.dumps(args)+'\\n')
if args[:2]==['image','load']:
    sys.stdin.buffer.read();sys.exit(0)
file=Path(args[args.index('-f')+1]);new=file.name=='compose.yaml'
if 'config' in args:
    conf={'networks':{},'volumes':{},'services':{'db':{'image':'postgres:17'},'api':{'environment':{'FRONTEND_URL':'https://demo.example'}},'web':{'ports':[{'published':'18080'}]}}}
    if new and os.getenv('TEST_DB_CHANGE'):conf['services']['db']['image']='postgres:18'
    print(json.dumps(conf))
elif 'exec' in args:
    if 'pg_restore' in args:sys.stdin.buffer.read()
    else:sys.stdout.buffer.write(b'PGDMP-backup')
elif new and 'run' in args and os.getenv('TEST_SCHEMA_FAIL'):
    sys.exit(1)
elif new and 'up' in args and args[-1]=='api' and os.getenv('TEST_API_FAIL'):
    sys.exit(1)
"""


class DeploymentTests(unittest.TestCase):
    def test_config_and_dry_run_never_connect(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "settings.json"
            config = {
                "host": "ubuntu@demo.example",
                "key": "/missing/key.pem",
                "remote_dir": "/home/ubuntu/apps/ec2demo",
                "origin": "https://demo.example",
            }
            path.write_text(json.dumps(config))
            r = subprocess.run(
                [
                    "python3",
                    str(SCRIPTS / "deploy_ec2.py"),
                    "--config",
                    str(path),
                    "--dry-run",
                ],
                check=False,
                text=True,
                capture_output=True,
            )
            self.assertEqual(r.returncode, 0, r.stderr)
            self.assertIn("No commands executed", r.stdout)
            config["host"] = "ubuntu@demo.example; touch /tmp/unsafe"
            path.write_text(json.dumps(config))
            with self.assertRaises(ValueError):
                deploy.settings(path)

    def exercise(self, flag=None, migrate=False):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / "app"
            release = root / "releases" / "test"
            release.mkdir(parents=True)
            (root / "deploy").mkdir()
            (root / "deploy/ec2.env").write_text("APP_ORIGIN=https://demo.example\n")
            (root / "compose.yaml").write_text("original-compose\n")
            (release / "compose.yaml").write_text("new-compose\n")
            (release / "deploy-remote.sh").write_text(
                (SCRIPTS / "deploy-remote.sh").read_text()
            )
            with gzip.open(release / "images.tar.gz", "wb") as f:
                f.write(b"mock images")
            checks = []
            for name in ("compose.yaml", "deploy-remote.sh", "images.tar.gz"):
                checks.append(
                    hashlib.sha256((release / name).read_bytes()).hexdigest()
                    + "  "
                    + name
                )
            (release / "SHA256SUMS").write_text("\n".join(checks) + "\n")
            binary = Path(tmp) / "bin"
            binary.mkdir()
            for name, body in {
                "sudo": '#!/bin/sh\nshift\nexec "$@"\n',
                "docker": DOCKER,
                "curl": "#!/bin/sh\nexit 0\n",
            }.items():
                p = binary / name
                p.write_text(body)
                p.chmod(0o755)
            log = Path(tmp) / "calls.jsonl"
            env = os.environ.copy()
            env["PATH"] = str(binary) + ":" + env["PATH"]
            env["TEST_LOG"] = str(log)
            if flag:
                env[flag] = "1"
            r = subprocess.run(
                [
                    "bash",
                    str(release / "deploy-remote.sh"),
                    str(root),
                    str(release),
                    "https://demo.example",
                    "yes" if migrate else "no",
                ],
                env=env,
                check=False,
                text=True,
                capture_output=True,
                timeout=20,
            )
            calls = [json.loads(line) for line in log.read_text().splitlines()]
            self.assertFalse((root / ".deploy-lock").exists())
            self.assertFalse((release / "new-config.json").exists())
            self.assertFalse(any("down" in call or "prune" in call for call in calls))
            if not flag:
                self.assertEqual(r.returncode, 0, r.stderr)
                self.assertEqual((root / "compose.yaml").read_text(), "new-compose\n")
                self.assertTrue((release / "database-before.dump").exists())
            else:
                self.assertNotEqual(r.returncode, 0)
                self.assertEqual(
                    (root / "compose.yaml").read_text(), "original-compose\n"
                )
            return r, calls

    def test_success_preserves_database_and_commits_release(self):
        self.exercise()

    def test_api_failure_rolls_back_images(self):
        r, calls = self.exercise("TEST_API_FAIL")
        self.assertIn("Previous API/web images restarted", r.stderr)
        self.assertTrue(
            any(
                "up" in call and "previous-compose.yaml" in " ".join(call)
                for call in calls
            )
        )

    def test_database_config_change_is_refused_before_cutover(self):
        r, calls = self.exercise("TEST_DB_CHANGE")
        self.assertIn("changes the database service", r.stderr)
        self.assertFalse(any("up" in call or "run" in call for call in calls))

    def test_schema_mismatch_does_not_stop_existing_app(self):
        _r, calls = self.exercise("TEST_SCHEMA_FAIL")
        self.assertFalse(any("stop" in call or "up" in call for call in calls))

    def test_failed_migration_retains_backup_and_warns_about_schema(self):
        r, _calls = self.exercise("TEST_SCHEMA_FAIL", migrate=True)
        self.assertIn("does not undo schema changes", r.stderr)
        self.assertIn("Previous API/web images restarted", r.stderr)


if __name__ == "__main__":
    unittest.main()
