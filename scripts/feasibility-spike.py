#!/usr/bin/env python3
"""Disposable ORAS/native-Claude feasibility probe; not a user installation tool."""
import argparse
import json
import os
import re
from pathlib import Path
import shutil
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--work-dir', type=Path, help='New directory for isolated probe files')
    parser.add_argument('--registry-repository', help='Optional supplied registry repository, without tag')
    args = parser.parse_args()
    work = args.work_dir.resolve() if args.work_dir else Path(tempfile.mkdtemp(prefix='oras-spike-'))
    if args.work_dir:
        work.mkdir(parents=True, exist_ok=False)
    env = dict(os.environ, CLAUDE_CONFIG_DIR=str(work / 'profile'),
               CLAUDE_CODE_DISABLE_OFFICIAL_MARKETPLACE_AUTOINSTALL='1')
    env.pop('CLAUDECODE', None)
    log = []

    def run(argv, cwd=None, check=True):
        result = subprocess.run(argv, cwd=cwd, env=env, text=True, capture_output=True, timeout=120)
        # Registry failures can include signed blob URLs. Never retain their query strings.
        result.stdout = re.sub(r'(https?://[^\s\"?]+)\?[^\s\"]+', r'\1?[redacted]', result.stdout)
        result.stderr = re.sub(r'(https?://[^\s\"?]+)\?[^\s\"]+', r'\1?[redacted]', result.stderr)
        entry = {'argv': argv, 'exitCode': result.returncode,
                 'stdout': result.stdout, 'stderr': result.stderr}
        log.append(entry)
        (work / 'commands.json').write_text(json.dumps(log, indent=2) + '\n')
        print('$ ' + ' '.join(argv), flush=True)
        print(result.stdout.strip(), flush=True)
        if result.stderr:
            print(result.stderr.strip(), flush=True)
        if check and result.returncode:
            raise RuntimeError(f'Command failed: {argv[0]} (exit {result.returncode})')
        return result

    for argv in [['uname', '-srm'], ['claude', '--version'], ['oras', 'version'], ['git', '--version']]:
        run(argv)
    marketplace = work / 'marketplace'
    (marketplace / '.claude-plugin').mkdir(parents=True)
    name = 'oci-demo-marketplace'
    manifest = json.loads((ROOT / 'examples/claude-oci-demo-marketplace/.claude-plugin/marketplace.json').read_text())
    manifest['name'] = name
    original_source = manifest['plugins'][0]['source']
    manifest['plugins'][0]['source'] = './plugins/oci-demo-plugin'
    manifest_path = marketplace / '.claude-plugin/marketplace.json'
    manifest_path.write_text(json.dumps(manifest, indent=2) + '\n')
    plugin_target = marketplace / 'plugins/oci-demo-plugin'
    provenance = {'gitSource': 'fixture:examples/claude-oci-demo-marketplace',
                  'ociSource': original_source, 'marketplace': name}
    layout = str(work / 'layout')
    ref = args.registry_repository + ':oci-demo-plugin-oras-spike' if args.registry_repository else layout + ':demo'
    layout_flags = [] if args.registry_repository else ['--oci-layout']
    digests = []
    for version in ['v1', 'v2']:
        plugin = ROOT / 'examples/oci-demo-plugin' / version
        metadata = json.loads((plugin / '.claude-plugin/plugin.json').read_text())
        run(['oras', 'push', *layout_flags, ref, '--artifact-type', 'application/vnd.dmartino.claude.plugin.v1',
             '--annotation', 'org.opencontainers.image.title=' + metadata['name'],
             '--annotation', 'org.opencontainers.image.version=' + metadata['version'], '.'], cwd=plugin)
        descriptor = json.loads(run(['oras', 'manifest', 'fetch', *layout_flags, '--descriptor', ref]).stdout)
        digest = descriptor['digest']
        digests.append(digest)
        pinned = (args.registry_repository or layout) + '@' + digest
        artifact = json.loads(run(['oras', 'manifest', 'fetch', *layout_flags, pinned]).stdout)
        assert artifact['artifactType'] == 'application/vnd.dmartino.claude.plugin.v1'
        assert artifact['annotations']['org.opencontainers.image.title'] == metadata['name']
        assert artifact['annotations']['org.opencontainers.image.version'] == metadata['version']
        assert artifact['layers'][0]['mediaType'] == 'application/vnd.oci.image.layer.v1.tar+gzip'
        assert artifact['layers'][0]['annotations']['io.deis.oras.content.unpack'] == 'true'
        stage = work / ('pulled-' + version)
        run(['oras', 'pull', *layout_flags, pinned, '--output', str(stage)])
        run(['claude', 'plugin', 'validate', '--strict', str(stage)])
        assert (stage / '.claude-plugin/plugin.json').is_file()
        # A failed pull must not touch the working local marketplace.
        if plugin_target.exists():
            before = (plugin_target / '.claude-plugin/plugin.json').read_bytes()
            bad_ref = (args.registry_repository or layout) + '@sha256:' + '0' * 64
            failed = run(['oras', 'pull', *layout_flags, bad_ref, '--output', str(work / 'failed-stage')], check=False)
            assert failed.returncode != 0
            assert (plugin_target / '.claude-plugin/plugin.json').read_bytes() == before
            preserved = json.loads(run(['claude', 'plugin', 'list', '--json']).stdout)
            preserved_entries = preserved if isinstance(preserved, list) else preserved.get('plugins', [])
            assert next(item for item in preserved_entries if item['id'] == 'oci-demo-plugin@' + name)['version'] == '0.1.0'
            backup = work / 'previous-plugin'
            plugin_target.rename(backup)
        plugin_target.parent.mkdir(exist_ok=True)
        shutil.copytree(stage, plugin_target)
        run(['claude', 'plugin', 'validate', '--strict', str(marketplace)])
        if version == 'v1':
            run(['claude', 'plugin', 'marketplace', 'add', str(marketplace), '--scope', 'user', '--json'])
            run(['claude', 'plugin', 'install', 'oci-demo-plugin@' + name, '--scope', 'user', '--json'])
        else:
            run(['claude', 'plugin', 'update', 'oci-demo-plugin@' + name, '--scope', 'user', '--json'])
        # Each CLI call is a fresh process against the retained isolated profile.
        installed = json.loads(run(['claude', 'plugin', 'list', '--json']).stdout)
        entries = installed if isinstance(installed, list) else installed.get('plugins', [])
        record = next(item for item in entries if item['id'] == 'oci-demo-plugin@' + name)
        assert record['version'] == metadata['version'], record
        installed_root = Path(record['installPath'])
        assert (installed_root / '.claude-plugin/plugin.json').is_file()
        assert metadata['version'] in (installed_root / 'skills/demo/SKILL.md').read_text()
        provenance.update(digest=digest, version=metadata['version'])
        (work / 'provenance.json').write_text(json.dumps(provenance, indent=2) + '\n')
        run(['claude', 'plugin', 'marketplace', 'list', '--json'])
    assert digests[0] != digests[1]
    print('PASS: digest-pinned extraction, native registration/install/update, fresh-process discovery, and failed-pull preservation.')
    print('NOT CHECKED: interactive /plugin UI, skill invocation, SessionStart alerts, or macOS behavior.')
    print('Evidence directory: ' + str(work))


if __name__ == '__main__':
    main()
