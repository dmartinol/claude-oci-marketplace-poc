#!/usr/bin/env python3
"""Create fresh Linux-local catalogs or switch them to already-published v2 tags."""
import json
import sys
from pathlib import Path
ROOT = Path('/sandbox/rehearsal')
SAMPLES = [
    ('claude-oci-demo-rehearsal', 'claude-oci-demo', '0.1.1-draft', '0.2.0-draft'),
    ('claude-oci-guide-rehearsal', 'claude-oci-guide', 'claude-oci-guide-0.1.0-draft', 'claude-oci-guide-0.2.0-draft'),
]
def write(path, value):
    path.write_text(json.dumps(value, indent=2) + '\n')
mode = sys.argv[1] if len(sys.argv) == 2 else ''
if mode == 'init':
    profile = ROOT / 'claude-config'
    catalogs = ROOT / 'catalogs'
    if any(p.exists() and any(p.iterdir()) for p in (profile, catalogs)):
        raise SystemExit('Rehearsal state already exists; refusing to overwrite it. Use a new sandbox for a clean rehearsal.')
    profile.mkdir(parents=True, exist_ok=True)
    catalogs.mkdir(parents=True, exist_ok=True)
    for marketplace, skill, v1, _ in SAMPLES:
        directory = catalogs / marketplace
        (directory / '.claude-plugin').mkdir(parents=True)
        write(directory / '.claude-plugin/marketplace.json', {
            'name': marketplace, 'description': 'Sandbox-local OCI rehearsal catalog',
            'owner': {'name': 'dmartinol'}, 'plugins': []})
        write(directory / 'oci-catalog.json', {'skills': [{
            'name': skill, 'description': 'Sandbox rehearsal for ' + skill,
            'repository': 'quay.io/dmartino/claude-oci-demo:' + v1}]})
    print('Fresh v1 catalogs created. No artifacts pulled, skills installed, or acceptance checks passed by this command.')
elif mode == 'v2':
    for marketplace, _, _, v2 in SAMPLES:
        path = ROOT / 'catalogs' / marketplace / 'oci-catalog.json'
        value = json.loads(path.read_text())
        value['skills'][0]['repository'] = 'quay.io/dmartino/claude-oci-demo:' + v2
        write(path, value)
    print('Catalogs point to v2. Review and approve updates in Claude; no artifact was installed by this command.')
else:
    raise SystemExit('Usage: rehearsal.py init|v2')
