"""Exercise deployment failures with fake Docker/SSH; never contact EC2."""

import gzip
import hashlib
import importlib.util
import json
import os
import subprocess
import tempfile
import unittest
from unittest.mock import patch
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
    if new and os.getenv('TEST_GEO_CONFIG_FAIL'):conf['services']['api']['environment']['GEO_DATA_ENABLED']='true'
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
                "compose_project": "campus-existing",
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

    def test_group_images_render_into_existing_cloud_project(self):
        source = (SCRIPTS.parent / "compose.yaml").read_text()
        rendered = deploy.render_compose(source, "campus-ec2demo", "campus-buildout-api:release", "campus-buildout-web:release")
        self.assertIn("name: campus-ec2demo\n", rendered)
        self.assertEqual(rendered.count("image: campus-buildout-api:release"), 2)
        self.assertEqual(rendered.count("image: campus-buildout-web:release"), 1)
        self.assertIn('COOKIE_SECURE: "true"', rendered)
        self.assertNotIn("image: campus-buildout-api:local", rendered)
        self.assertIn("name: campus-buildout\n", source)
        self.assertEqual(source.split("  db:")[1].split("  api:")[0], rendered.split("  db:")[1].split("  api:")[0])
        self.assertEqual(source.split("networks:\n")[-1], rendered.split("networks:\n")[-1])
        with self.assertRaises(ValueError):
            deploy.render_compose(source.replace("campus-buildout-api:local", "unexpected:local"), "campus-ec2demo", "api:new", "web:new")

    def test_project_setting_is_required_and_validated(self):
        config = json.loads((SCRIPTS.parent / "deploy/deploy-settings.json.example").read_text())
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "settings.json"
            for invalid in (None, "", "bad project", "--unsafe", "project;command", "Uppercase"):
                config["compose_project"] = invalid
                path.write_text(json.dumps(config))
                with self.assertRaises(ValueError):
                    deploy.settings(path)

    def test_cloud_maps_default_and_explicit_overrides(self):
        self.assertEqual(deploy.web_build_settings({}, {})["EXPO_PUBLIC_MAPS_ENABLED"], "true")
        values = deploy.web_build_settings({"web_build": {"EXPO_PUBLIC_MAPS_ENABLED": "false"}},
                                          {"EXPO_PUBLIC_MAPS_ENABLED": "true"})
        self.assertEqual(values["EXPO_PUBLIC_MAPS_ENABLED"], "true")
        for invalid in ({"DB_PASSWORD": "secret"}, {"EXPO_PUBLIC_MAPS_ENABLED": True},
                        {"EXPO_PUBLIC_MAPS_ENABLED": "yes"}):
            with self.assertRaises(ValueError):
                deploy.web_build_settings({"web_build": invalid}, {})

    def test_cloud_street_style_is_available_without_local_dotenv(self):
        expected = "https://tiles.openfreemap.org/styles/liberty"
        self.assertEqual(deploy.web_build_settings({}, {})["EXPO_PUBLIC_MAP_STREET_STYLE"], expected)
        self.assertEqual(deploy.web_build_settings({"web_build": {"EXPO_PUBLIC_MAP_STREET_STYLE": ""}}, {})["EXPO_PUBLIC_MAP_STREET_STYLE"], expected)
        custom = "https://example.com/style.json"
        self.assertEqual(deploy.web_build_settings({}, {"EXPO_PUBLIC_MAP_STREET_STYLE": custom})["EXPO_PUBLIC_MAP_STREET_STYLE"], custom)
        self.assertEqual(deploy.web_build_settings({}, {"EXPO_PUBLIC_MAPTILER_KEY": "public-key"})["EXPO_PUBLIC_MAP_STREET_STYLE"], "")

    def test_full_local_pipeline_builds_uploads_and_invokes_remote(self):
        # Exercise the real non-dry-run orchestration without Docker or a server.
        with tempfile.TemporaryDirectory() as tmp:
            key = Path(tmp) / "key.pem"
            key.touch()
            config = {"host": "ubuntu@demo.example", "key": str(key),
                      "remote_dir": "/home/ubuntu/apps/ec2demo",
                      "origin": "https://demo.example", "compose_project": "campus-existing"}
            path = Path(tmp) / "settings.json"
            path.write_text(json.dumps(config))
            calls = []

            def fake_run(args, **kwargs):
                calls.append(args)
                if args[:3] == ["docker", "image", "save"]:
                    Path(args[args.index("-o") + 1]).write_bytes(b"images")
                if args[0] == "scp":
                    compose = next(Path(arg) for arg in args if arg.endswith("/compose.yaml"))
                    self.assertIn("name: campus-existing", compose.read_text())
                    self.assertTrue((compose.parent / "SHA256SUMS").is_file())

            with patch.object(deploy, "run", side_effect=fake_run), \
                 patch.object(deploy, "ssh", side_effect=["aarch64", None, None]) as remote, \
                 patch.object(deploy.shutil, "which", return_value="/mock/tool"), \
                 patch.dict(os.environ, {}, clear=True), \
                 patch.object(deploy.sys, "argv", ["deploy", "--config", str(path), "--migrate"]):
                deploy.main()
            builds = [call for call in calls if call[:2] == ["docker", "build"]]
            self.assertEqual(len(builds), 2)
            self.assertTrue(all("linux/arm64" in call for call in builds))
            self.assertIn("EXPO_PUBLIC_MAPS_ENABLED=true", builds[1])
            self.assertIn("EXPO_PUBLIC_MAP_STREET_STYLE=https://tiles.openfreemap.org/styles/liberty", builds[1])
            self.assertIn("EXPO_PUBLIC_API_URL=https://demo.example", builds[1])
            self.assertEqual(remote.call_args.args[2][-2:], ["yes", "campus-existing"])

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
                    "campus-existing",
                ],
                env=env,
                check=False,
                text=True,
                capture_output=True,
                timeout=20,
            )
            calls = [json.loads(line) for line in log.read_text().splitlines()]
            for call in calls:
                if 'compose' in call:
                    self.assertEqual(call[call.index('-p') + 1], 'campus-existing')
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

    def test_incomplete_spatial_configuration_is_refused_before_backup(self):
        r, calls = self.exercise("TEST_GEO_CONFIG_FAIL")
        self.assertIn("GEO_DATA_ENABLED requires GEO_DATABASE_URL", r.stderr)
        self.assertFalse(any("stop" in call or "run" in call or "exec" in call for call in calls))

    def test_schema_mismatch_does_not_stop_existing_app(self):
        _r, calls = self.exercise("TEST_SCHEMA_FAIL")
        self.assertFalse(any("stop" in call or "up" in call for call in calls))

    def test_failed_migration_retains_backup_and_warns_about_schema(self):
        r, _calls = self.exercise("TEST_SCHEMA_FAIL", migrate=True)
        self.assertIn("does not undo schema changes", r.stderr)
        self.assertIn("Previous API/web images restarted", r.stderr)


if __name__ == "__main__":
    unittest.main()
