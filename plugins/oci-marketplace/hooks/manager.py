#!/usr/bin/env python3
"""Small ORAS-to-Claude marketplace adapter. All output is JSON; no credentials are stored."""
import argparse
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
from urllib.parse import urlsplit

ARTIFACT_TYPE = 'application/vnd.dmartino.claude.plugin.v1'
LAYER_TYPE = 'application/vnd.oci.image.layer.v1.tar+gzip'
STATE_FILE = '.marketplace-manager.json'
PLUGIN_DIR = '.oci-plugins'
NAME = re.compile(r'^[A-Za-z0-9][A-Za-z0-9._-]*$')
DIGEST = re.compile(r'^sha256:[a-f0-9]{64}$')
REFERENCE = re.compile(r'^([A-Za-z0-9.-]+(?::[0-9]{1,5})?/[a-z0-9]+(?:[._-][a-z0-9]+)*(?:/[a-z0-9]+(?:[._-][a-z0-9]+)*)*):([A-Za-z0-9_][A-Za-z0-9_.-]{0,127})$')


def safe_error(value):
    # Quay errors may contain signed redirect URLs. Do not display/persist their queries.
    return re.sub(r'(https?://[^\s\"?]+)\?[^\s\"]+', r'\1?[redacted]', str(value))


def parse_reference(source):
    match = REFERENCE.fullmatch(source) if isinstance(source, str) else None
    if not match:
        raise ValueError('source must be a raw registry/repository:tag reference')
    return match.group(1), match.group(2)


def oci_plugins(manifest):
    if not isinstance(manifest, dict) or not NAME.fullmatch(manifest.get('name', '')):
        raise ValueError('Marketplace must have a path-safe name')
    if not isinstance(manifest.get('plugins'), list):
        raise ValueError('Marketplace plugins must be an array')
    result, names = [], set()
    for entry in manifest['plugins']:
        if not isinstance(entry, dict) or not NAME.fullmatch(entry.get('name', '')):
            raise ValueError('Every plugin must have a path-safe name')
        if entry['name'] in names:
            raise ValueError('Duplicate plugin name: ' + entry['name'])
        names.add(entry['name'])
        source = entry.get('source')
        if not isinstance(source, str) or source.startswith(('./', '../', '/', 'git@')):
            continue
        if '://' in source and not source.startswith('oci://'):
            continue
        # Native plugin sources are path strings or objects. Registry-shaped strings
        # (including malformed OCI values) must be validated rather than ignored.
        if '/' in source and (source.startswith('oci://') or '.' in source.split('/')[0] or ':' in source.split('/')[0] or source.startswith('localhost/')):
            parse_reference(source)
            if not isinstance(entry.get('description'), str) or not entry['description'].strip():
                raise ValueError('OCI plugin description is required')
            result.append(entry)
    return result


def read_json(path):
    return json.loads(Path(path).read_text())


def atomic_json(path, value):
    path = Path(path)
    temporary = path.with_name(path.name + '.tmp')
    temporary.write_text(json.dumps(value, indent=2) + '\n')
    temporary.replace(path)


def run(argv, cwd=None, env=None):
    result = subprocess.run(argv, cwd=cwd, env=env, text=True, capture_output=True, timeout=180)
    if result.returncode:
        raise RuntimeError(safe_error(result.stderr.strip() or result.stdout.strip() or f'{argv[0]} exited {result.returncode}'))
    return result.stdout


def validate_bundle(path, name, version):
    path = Path(path)
    for item in path.rglob('*'):
        if item.is_symlink():
            raise ValueError('Plugin bundles must not contain symlinks')
    manifest = read_json(path / '.claude-plugin/plugin.json')
    if manifest.get('name') != name or manifest.get('version') != version:
        raise ValueError('Plugin name/version does not match inspected OCI metadata')


class Manager:
    def __init__(self, config_root=None):
        self.config = Path(config_root or os.environ.get('CLAUDE_CONFIG_DIR') or Path.home() / '.claude').expanduser().resolve()
        self.root = self.config / 'marketplace-manager'
        self.marketplaces = self.root / 'marketplaces'
        self.env = dict(os.environ, CLAUDE_CONFIG_DIR=str(self.config))

    def run(self, argv, cwd=None):
        return run(argv, cwd=cwd, env=self.env)

    def registrations(self):
        registrations = json.loads(self.run(['claude', 'plugin', 'marketplace', 'list', '--json']))
        if not isinstance(registrations, list):
            raise ValueError('Claude marketplace list did not return an array')
        return registrations

    def native_installed(self):
        value = json.loads(self.run(['claude', 'plugin', 'list', '--json']))
        entries = value if isinstance(value, list) else value.get('plugins', [])
        project = Path(self.env.get('CLAUDE_PROJECT_DIR') or os.getcwd()).expanduser().resolve()
        priorities = {'user': 1, 'project': 2, 'local': 3}
        installed = {}
        for entry in entries:
            identity = entry.get('id')
            scope = entry.get('scope')
            if not identity or scope not in priorities:
                continue
            if scope in ('project', 'local'):
                entry_project = entry.get('projectPath')
                if not entry_project or Path(entry_project).expanduser().resolve() != project:
                    continue
            previous = installed.get(identity)
            if previous and priorities[previous['scope']] >= priorities[scope]:
                continue
            installed[identity] = entry
        return installed

    def owned(self, registration):
        name = registration['name']
        if not NAME.fullmatch(name):
            raise ValueError('Invalid registered marketplace name')
        location = Path(registration['installLocation']).resolve()
        if location != self.marketplaces / name:
            return None
        state = read_json(location / STATE_FILE)
        if state.get('marketplace') != name or state.get('schema') != 1:
            raise ValueError('Invalid generated marketplace provenance')
        return state

    def list(self):
        marketplaces, plugins, errors = [], [], []
        installed = self.native_installed()
        for registration in self.registrations():
            try:
                state = self.owned(registration)
                row = {'name': registration['name'], 'source': state['gitSource'] if state else registration.get('url') or registration.get('repo') or registration.get('path') or str(registration.get('source', 'native')),
                       'classification': 'OCI-enabled' if state else 'standard-only'}
                marketplaces.append(row)
                manifest = read_json(Path(registration['installLocation']) / '.claude-plugin/marketplace.json')
                for entry in manifest['plugins']:
                    name = entry['name']
                    identity = name + '@' + registration['name']
                    record = state['plugins'].get(name) if state else None
                    if record:
                        record = dict(record, kind='oci')
                    else:
                        source = entry.get('source')
                        version = installed.get(identity, {}).get('version') or entry.get('version', '')
                        if not version and isinstance(source, str) and source.startswith('./'):
                            local_manifest = Path(registration['installLocation']) / source / '.claude-plugin/plugin.json'
                            if local_manifest.is_file():
                                version = read_json(local_manifest).get('version', '')
                        record = {'kind': 'standard', 'source': source if isinstance(source, str) else json.dumps(source),
                                  'description': entry.get('description', ''), 'version': version,
                                  'registry': '', 'digest': ''}
                    native = installed.get(identity)
                    plugins.append(dict(record, name=name, marketplace=registration['name'],
                                        identity=identity, installed=native is not None,
                                        installedScope=native.get('scope') if native else None))
            except (ValueError, KeyError, OSError) as error:
                errors.append(safe_error(f"{registration.get('name')}: {error}"))
        return {'marketplaces': marketplaces, 'plugins': plugins, 'errors': errors}

    def installed(self):
        result = self.list()
        return {'plugins': [plugin for plugin in result['plugins'] if plugin['installed']], 'errors': result['errors']}

    def plugin(self, identity):
        result = self.list()
        for plugin in result['plugins']:
            if plugin['identity'] == identity:
                return plugin
        raise ValueError('No registered plugin named ' + identity)

    def updates(self):
        result = self.list()
        updates, errors = [], result['errors']
        for plugin in result['plugins']:
            if plugin['kind'] != 'oci':
                continue
            try:
                metadata = self.inspect(plugin['source'])
                if metadata['name'] != plugin['name']:
                    raise ValueError('OCI title does not match the marketplace plugin name')
                if metadata['digest'] != plugin['digest']:
                    updates.append(dict(plugin, metadata=metadata, installedVersion=plugin['version']))
            except Exception as error:
                errors.append(safe_error(plugin['identity'] + ': ' + str(error)))
        return {'updates': updates, 'errors': errors}

    def install(self, identity):
        self.plugin(identity)
        self.run(['claude', 'plugin', 'install', identity, '--scope', 'user', '--json'])
        return {'text': 'Installed ' + identity + '. Restart Claude to use the plugin.'}

    def update(self, identity, digest, version):
        plugin = self.plugin(identity)
        if plugin['kind'] != 'oci':
            raise ValueError('Use /plugin for standard plugin updates')
        # Inspect the reviewed digest, never re-resolve the mutable tag after approval.
        metadata = self.inspect(plugin['source'], digest)
        if metadata['version'] != version:
            raise ValueError('Version does not match the reviewed OCI digest')
        if metadata['digest'] == plugin['digest']:
            return {'text': identity + ' is already at the reviewed digest.'}
        marketplace = self.marketplaces / plugin['marketplace']
        target = marketplace / PLUGIN_DIR / plugin['name']
        state_path = marketplace / STATE_FILE
        manifest_path = marketplace / '.claude-plugin/marketplace.json'
        previous_state = state_path.read_bytes()
        previous_manifest = manifest_path.read_bytes()
        state = json.loads(previous_state)
        manifest = json.loads(previous_manifest)
        was_installed = plugin['installed']
        installed_scope = plugin.get('installedScope') or 'user'
        with tempfile.TemporaryDirectory(prefix='.update-', dir=self.root) as temporary:
            stage = Path(temporary) / 'plugin'
            backup = Path(temporary) / 'previous'
            self.pull(plugin['source'], metadata, stage, plugin['name'])
            target.rename(backup)
            try:
                stage.rename(target)
                for entry in manifest['plugins']:
                    if entry['name'] == plugin['name'] and 'version' in entry:
                        entry['version'] = version
                atomic_json(manifest_path, manifest)
                self.run(['claude', 'plugin', 'validate', '--strict', str(marketplace)])
                if was_installed:
                    self.run(['claude', 'plugin', 'update', identity, '--scope', installed_scope, '--json'])
                state['plugins'][plugin['name']].update(version=version, digest=digest)
                atomic_json(state_path, state)
            except Exception as error:
                if target.exists():
                    shutil.rmtree(target)
                backup.rename(target)
                manifest_path.write_bytes(previous_manifest)
                state_path.write_bytes(previous_state)
                # Native update normally leaves its old record on failure. If it did
                # change, restore through the same supported command against v1.
                if was_installed:
                    try:
                        native = self.native_installed().get(identity)
                        if native and native.get('version') != plugin['version']:
                            self.run(['claude', 'plugin', 'update', identity, '--scope', installed_scope, '--json'])
                    except Exception as recovery:
                        raise RuntimeError(safe_error(f'{error}; previous bundle restored, but native recovery failed: {recovery}')) from error
                raise RuntimeError(safe_error(f'{error}; previous plugin and digest restored')) from error
        return {'text': 'Updated ' + identity + ' to v' + version + ' (' + digest + '). Restart Claude to apply.'}

    def inspect(self, source, digest=None):
        repository, _ = parse_reference(source)
        if digest is None:
            descriptor = json.loads(self.run(['oras', 'manifest', 'fetch', '--descriptor', source]))
            digest = descriptor['digest']
        if not DIGEST.fullmatch(digest):
            raise ValueError('Expected a sha256 manifest digest')
        manifest = json.loads(self.run(['oras', 'manifest', 'fetch', repository + '@' + digest]))
        annotations = manifest.get('annotations', {})
        name = annotations.get('org.opencontainers.image.title', '')
        version = annotations.get('org.opencontainers.image.version', '')
        layers = manifest.get('layers', [])
        if manifest.get('artifactType') != ARTIFACT_TYPE or len(layers) != 1 or layers[0].get('mediaType') != LAYER_TYPE or layers[0].get('annotations', {}).get('io.deis.oras.content.unpack') != 'true':
            raise ValueError('Unsupported OCI plugin artifact or directory layer')
        if not isinstance(name, str) or not NAME.fullmatch(name) or not isinstance(version, str) or not version.strip():
            raise ValueError('OCI title and version annotations are required')
        return {'name': name, 'version': version, 'digest': digest, 'registry': repository.split('/')[0]}

    def pull(self, source, metadata, destination, expected_name):
        if metadata['name'] != expected_name:
            raise ValueError('OCI title does not match the marketplace plugin name')
        repository, _ = parse_reference(source)
        self.run(['oras', 'pull', repository + '@' + metadata['digest'], '--output', str(destination)])
        validate_bundle(destination, expected_name, metadata['version'])
        self.run(['claude', 'plugin', 'validate', '--strict', str(destination)])

    def add(self, source):
        if not source or source.startswith('-') or any(ord(c) < 32 for c in source):
            raise ValueError('Provide a Git marketplace URL')
        parsed = urlsplit(source)
        if parsed.password or (parsed.scheme in ('http', 'https') and (parsed.username or parsed.query)):
            raise ValueError('Use existing Git credentials; do not embed credentials in marketplace URLs')
        self.marketplaces.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(prefix='.add-', dir=self.root) as temporary:
            checkout = Path(temporary) / 'checkout'
            # Match Claude's supported Git URL#branch-or-tag convention.
            git_source, separator, ref = source.partition('#')
            branch = ['--branch', ref] if separator and ref else []
            self.run(['git', 'clone', '--depth', '1', *branch, '--', git_source, str(checkout)])
            manifest_path = checkout / '.claude-plugin/marketplace.json'
            manifest = read_json(manifest_path)
            entries = oci_plugins(manifest)
            name = manifest['name']
            if any(row['name'] == name for row in self.registrations()):
                raise ValueError('Marketplace is already registered: ' + name)
            if not entries:
                self.run(['claude', 'plugin', 'marketplace', 'add', source, '--scope', 'user', '--json'])
                return {'text': 'Added standard marketplace ' + name + '. Use /plugin to install its plugins.'}
            target = self.marketplaces / name
            if target.exists():
                raise ValueError('Generated files already exist for ' + name + '; remove the old demo files before re-adding')
            if (checkout / PLUGIN_DIR).exists() or (checkout / PLUGIN_DIR).is_symlink():
                raise ValueError('Marketplace uses the manager-reserved directory ' + PLUGIN_DIR)
            (checkout / PLUGIN_DIR).mkdir()
            state = {'schema': 1, 'marketplace': name, 'gitSource': source, 'plugins': {}}
            for entry in entries:
                original_source = entry['source']
                metadata = self.inspect(original_source)
                self.pull(original_source, metadata, checkout / PLUGIN_DIR / entry['name'], entry['name'])
                state['plugins'][entry['name']] = dict(source=original_source, description=entry['description'],
                                                      version=metadata['version'], digest=metadata['digest'], registry=metadata['registry'])
                entry['source'] = './' + PLUGIN_DIR + '/' + entry['name']
                if 'version' in entry:
                    entry['version'] = metadata['version']
            atomic_json(manifest_path, manifest)
            atomic_json(checkout / STATE_FILE, state)
            shutil.rmtree(checkout / '.git')
            self.run(['claude', 'plugin', 'validate', '--strict', str(checkout)])
            checkout.rename(target)
            try:
                self.run(['claude', 'plugin', 'marketplace', 'add', str(target), '--scope', 'user', '--json'])
            except Exception:
                shutil.rmtree(target)
                raise
        return {'text': 'Added ' + name + '. View and install plugins through /plugin or /marketplace-manager.'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['list', 'installed', 'updates', 'add', 'install', 'update'])
    parser.add_argument('arguments', nargs='*')
    args = parser.parse_args()
    manager = Manager()
    try:
        if args.action == 'add' and len(args.arguments) == 1:
            result = manager.add(args.arguments[0])
        elif args.action == 'install' and len(args.arguments) == 1:
            result = manager.install(args.arguments[0])
        elif args.action == 'update' and len(args.arguments) == 3:
            result = manager.update(*args.arguments)
        elif args.action in ('list', 'installed', 'updates') and not args.arguments:
            result = getattr(manager, args.action)()
        else:
            raise ValueError('Invalid command arguments')
        print(json.dumps(result))
    except Exception as error:
        print(json.dumps({'error': safe_error(error)}), file=sys.stderr)
        raise SystemExit(1)


if __name__ == '__main__':
    main()
