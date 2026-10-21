#!/usr/bin/env python3
"""Build local source and deploy prebuilt images to an existing messaging stack."""

import argparse
import gzip
import hashlib
import json
import re
import shlex
import shutil
import subprocess
import sys
import tempfile
import uuid
from datetime import UTC, datetime
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]


def settings(path):
    config = json.loads(path.read_text())
    for key in ("host", "key", "remote_dir", "origin", "compose_project"):
        if not isinstance(config.get(key), str) or not config[key]:
            raise ValueError(f"Missing configuration: {key}")
    if not re.fullmatch(r"[A-Za-z0-9_.-]+@[A-Za-z0-9_.-]+", config["host"]):
        raise ValueError("host must be user@hostname (no shell options)")
    if not re.fullmatch(r"[a-z0-9][a-z0-9_-]*", config["compose_project"]):
        raise ValueError("compose_project must be a lowercase Docker Compose project name")
    remote = config["remote_dir"]
    if (
        not re.fullmatch(r"/[A-Za-z0-9_./-]+", remote)
        or ".." in Path(remote).parts
        or remote == "/"
    ):
        raise ValueError("remote_dir must be an absolute application directory")
    origin = urlsplit(config["origin"])
    if (
        origin.scheme != "https"
        or not origin.hostname
        or origin.username
        or origin.password
        or origin.query
        or origin.fragment
        or origin.path not in ("", "/")
    ):
        raise ValueError(
            "origin must be an HTTPS origin, without credentials or a path"
        )
    config["origin"] = config["origin"].rstrip("/")
    config["key"] = str(Path(config["key"]).expanduser().resolve())
    return config


def render_compose(source, project, api_image, web_image):
    """Keep local isolation while using the existing cloud project's volumes/networks."""
    if (
        source.count("image: campus-groupdemo-api:local") != 2
        or source.count("image: campus-groupdemo-web:local") != 1
        or len(re.findall(r"^name: campus-groupdemo$", source, re.MULTILINE)) != 1
    ):
        raise ValueError("Unexpected Compose image/project definitions; review deployment rendering")
    source = re.sub(r"^name: campus-groupdemo$", "name: " + project, source, flags=re.MULTILINE)
    source = source.replace("image: campus-groupdemo-api:local", "image: " + api_image)
    source = source.replace("image: campus-groupdemo-web:local", "image: " + web_image)
    return source.replace('COOKIE_SECURE: ${COOKIE_SECURE:-false}', 'COOKIE_SECURE: "true"')


def run(args, **kwargs):
    print("+ " + shlex.join(str(arg) for arg in args), flush=True)
    return subprocess.run(args, check=True, **kwargs)


def ssh(config, script, arguments=(), capture=False):
    command = "bash -s -- " + shlex.join(str(arg) for arg in arguments)
    result = run(
        [
            "ssh",
            "-i",
            config["key"],
            "-o",
            "BatchMode=yes",
            "-o",
            "StrictHostKeyChecking=yes",
            "-o",
            "ConnectTimeout=15",
            config["host"],
            command,
        ],
        input=script,
        text=True,
        stdout=subprocess.PIPE if capture else None,
    )
    return result.stdout.strip() if capture else None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--config", type=Path, default=ROOT / "deploy/deploy-settings.json"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print the plan without running Docker, SSH, or SCP",
    )
    parser.add_argument(
        "--migrate",
        action="store_true",
        help="Explicitly apply schema migrations after backup; requires a maintenance window",
    )
    args = parser.parse_args()
    config = settings(args.config)
    print(
        f"Source: {ROOT}\nTarget: {config['host']}:{config['remote_dir']}\nCompose project: {config['compose_project']}\nWebsite: {config['origin']}"
    )
    # Validate local rendering before any remote connection or expensive image build.
    compose_source = (ROOT / "compose.yaml").read_text()
    render_compose(compose_source, config["compose_project"], "campus-groupdemo-api:check", "campus-groupdemo-web:check")
    if args.dry_run:
        print(
            "Plan: inspect existing stack/architecture; build API and web images locally; upload a checksummed release;"
        )
        print(
            "back up cloud database; validate Compose settings and schema; replace API then web; verify HTTPS."
        )
        print(
            "Migrations: "
            + (
                "APPLY (explicit --migrate)"
                if args.migrate
                else "check only; fail if a migration is needed"
            )
        )
        print(
            "Cloud database/credentials persist; shared Nginx is not modified. No commands executed."
        )
        return
    for tool in ("docker", "ssh", "scp"):
        if not shutil.which(tool):
            raise ValueError(f"Required command unavailable: {tool}")
    if not Path(config["key"]).is_file():
        raise ValueError("SSH key file does not exist")
    # Fail before building if the established target is unavailable.
    arch = ssh(
        config,
        """set -e
cd "$1"
test -f compose.yaml && test -f deploy/ec2.env
sudo -n docker compose version >/dev/null
sudo -n docker compose -p "$2" --env-file deploy/ec2.env ps --status running -q db | grep -q .
uname -m
""",
        [config["remote_dir"], config["compose_project"]],
        capture=True,
    ).splitlines()[-1]
    platform = {"aarch64": "linux/arm64", "x86_64": "linux/amd64"}.get(arch)
    if not platform:
        raise ValueError(f"Unsupported server architecture: {arch}")
    release = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ") + "-" + uuid.uuid4().hex[:8]
    api = "campus-groupdemo-api:" + release
    web = "campus-groupdemo-web:" + release
    with tempfile.TemporaryDirectory(prefix="campus-deploy-") as directory:
        bundle = Path(directory)
        run(
            [
                "docker",
                "build",
                "--platform",
                platform,
                "-f",
                "backend/Dockerfile",
                "-t",
                api,
                ".",
            ],
            cwd=ROOT,
        )
        run(
            [
                "docker",
                "build",
                "--platform",
                platform,
                "-f",
                "frontend/Dockerfile",
                "--build-arg",
                "EXPO_PUBLIC_API_URL=" + config["origin"],
                "-t",
                web,
                ".",
            ],
            cwd=ROOT,
        )
        image_tar = bundle / "images.tar"
        run(["docker", "image", "save", "-o", str(image_tar), api, web])
        with (
            image_tar.open("rb") as source,
            gzip.open(bundle / "images.tar.gz", "wb") as target,
        ):
            shutil.copyfileobj(source, target)
        image_tar.unlink()
        compose = render_compose(compose_source, config["compose_project"], api, web)
        (bundle / "compose.yaml").write_text(compose)
        shutil.copy2(ROOT / "scripts/deploy-remote.sh", bundle / "deploy-remote.sh")
        checks = []
        for name in ("images.tar.gz", "compose.yaml", "deploy-remote.sh"):
            with (bundle / name).open("rb") as file:
                digest = hashlib.file_digest(file, "sha256").hexdigest()
            checks.append(f"{digest}  {name}")
        (bundle / "SHA256SUMS").write_text("\n".join(checks) + "\n")
        remote_release = config["remote_dir"] + "/releases/" + release
        ssh(config, 'set -e\numask 077\nmkdir -p "$1"\n', [remote_release])
        run(
            [
                "scp",
                "-i",
                config["key"],
                "-o",
                "BatchMode=yes",
                "-o",
                "StrictHostKeyChecking=yes",
                *[
                    str(bundle / name)
                    for name in (
                        "images.tar.gz",
                        "compose.yaml",
                        "deploy-remote.sh",
                        "SHA256SUMS",
                    )
                ],
                config["host"] + ":" + remote_release + "/",
            ]
        )
        ssh(
            config,
            'exec bash "$2/deploy-remote.sh" "$1" "$2" "$3" "$4" "$5"\n',
            [
                config["remote_dir"],
                remote_release,
                config["origin"],
                "yes" if args.migrate else "no",
                config["compose_project"],
            ],
        )
    print(
        f"Deployed {release} to {config['origin']}. Server release and backup retained in {remote_release}."
    )


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError, subprocess.CalledProcessError) as error:
        print(f"Deployment failed: {error}", file=sys.stderr)
        sys.exit(1)
