#!/usr/bin/env python3
"""Explicit one-time spatial bootstrap from a public OSM snapshot, built on the Mac."""
import argparse
import gzip
import hashlib
import shutil
import tempfile
from pathlib import Path
from deploy_ec2 import ROOT, settings, ssh, run

p = argparse.ArgumentParser(description=__doc__)
p.add_argument('--snapshot', required=True, type=Path)
p.add_argument('--captured-at', required=True, help='Actual UTC snapshot retrieval timestamp')
p.add_argument('--config', type=Path, default=ROOT/'deploy/deploy-settings.json')
a = p.parse_args()
config = settings(a.config)
if not a.snapshot.is_file() or a.snapshot.stat().st_size > 20_000_000:
    p.error('Snapshot must exist and be at most 20 MB')
arch = ssh(config, 'uname -m\n', capture=True)
platform = {'aarch64': 'linux/arm64', 'x86_64': 'linux/amd64'}[arch]
run(['docker','build','--platform',platform,'-t','campus-spatial:bootstrap','deploy/spatial'], cwd=ROOT)
run(['docker','build','--platform',platform,'-t','campus-spatial-operator:bootstrap','-f','backend/Dockerfile','.'], cwd=ROOT)
with tempfile.TemporaryDirectory(prefix='campus-spatial-') as tmp:
    folder = Path(tmp)
    run(['docker','save','-o',str(folder/'images.tar'),'campus-spatial:bootstrap','campus-spatial-operator:bootstrap'])
    with (folder/'images.tar').open('rb') as source, gzip.open(folder/'images.tar.gz','wb') as target:
        shutil.copyfileobj(source,target)
    (folder/'images.tar').unlink()
    shutil.copy2(a.snapshot,folder/'campus.osm')
    shutil.copy2(ROOT/'deploy/compose.spatial-ec2.yaml',folder/'compose.yaml')
    shutil.copy2(ROOT/'scripts/setup-spatial-remote.sh',folder/'setup.sh')
    names=['images.tar.gz','campus.osm','compose.yaml','setup.sh']
    (folder/'SHA256SUMS').write_text(''.join(hashlib.sha256((folder/n).read_bytes()).hexdigest()+'  '+n+'\n' for n in names))
    remote=config['remote_dir']+'/deploy/spatial-bootstrap'
    ssh(config, 'set -e\numask 077\nmkdir -p "$1"\n', [remote])
    run(['scp','-i',config['key'],'-o','BatchMode=yes','-o','StrictHostKeyChecking=yes',*[str(folder/n) for n in names+['SHA256SUMS']],config['host']+':'+remote+'/'])
    ssh(config,'exec bash "$1/deploy/spatial-bootstrap/setup.sh" "$@"\n',[config['remote_dir'],config['compose_project'],a.captured_at])
