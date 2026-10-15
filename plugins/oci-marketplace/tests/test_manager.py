"""Focused OCI helper checks; all registries and native Claude calls are fixtures."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from types import SimpleNamespace
from unittest.mock import patch

MODULE_PATH = Path(__file__).resolve().parents[1] / 'hooks' / 'manager.py'
spec = importlib.util.spec_from_file_location('oci_manager', MODULE_PATH)
manager = importlib.util.module_from_spec(spec)
spec.loader.exec_module(manager)

SOURCE = 'quay.io/example/demo:latest'
DIGEST_V1 = 'sha256:' + '1' * 64
DIGEST_V2 = 'sha256:' + '2' * 64
IDENTITY = 'demo@demo-marketplace'


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value))


def bundle(path, version='1.0.0', name='demo'):
    write_json(path / '.claude-plugin' / 'plugin.json', {'name': name, 'version': version})
    skill = path / 'skills' / 'demo' / 'SKILL.md'
    skill.parent.mkdir(parents=True, exist_ok=True)
    skill.write_text('---\nname: demo\ndescription: Demo plugin\n---\nVersion ' + version)


def artifact(version='1.0.0', name='demo'):
    return {'artifactType': manager.ARTIFACT_TYPE,
            'annotations': {'org.opencontainers.image.title': name,
                            'org.opencontainers.image.version': version},
            'layers': [{'mediaType': manager.LAYER_TYPE,
                        'annotations': {'io.deis.oras.content.unpack': 'true'}}]}


class FixtureRunner:
    """Represent Git/OCI/native CLI boundaries, keeping the helper filesystem real."""
    def __init__(self, testcase):
        self.testcase = testcase
        self.calls = []
        self.registrations = []
        self.installed = []
        self.digest = DIGEST_V1
        self.artifacts = {DIGEST_V1: artifact(), DIGEST_V2: artifact('2.0.0')}
        self.manifest = {'name': 'demo-marketplace', 'owner': {'name': 'Demo'}, 'plugins': [
            {'name': 'demo', 'description': 'Demo plugin', 'source': SOURCE},
            {'name': 'standard', 'description': 'Native plugin', 'source': './standard'},
        ]}
        self.fail_pull = False
        self.fail_native = False
        self.bad_bundle = False
        self.fail_validation = False

    def __call__(self, argv, cwd=None):
        self.calls.append(list(argv))
        if argv[:2] == ['git', 'clone']:
            checkout = Path(argv[-1])
            write_json(checkout / '.claude-plugin/marketplace.json', self.manifest)
            (checkout / '.git').mkdir()
            bundle(checkout / 'standard', name='standard')
            return ''
        if argv[:4] == ['claude', 'plugin', 'marketplace', 'list']:
            return json.dumps(self.registrations)
        if argv[:3] == ['claude', 'plugin', 'list']:
            return json.dumps(self.installed)
        if argv[:4] == ['claude', 'plugin', 'marketplace', 'add']:
            if self.fail_native:
                raise RuntimeError('injected native registration failure')
            location = Path(argv[4])
            if location.exists():
                name = json.loads((location / '.claude-plugin/marketplace.json').read_text())['name']
                self.registrations.append({'name': name, 'installLocation': str(location)})
            return '{}'
        if argv[:3] == ['oras', 'manifest', 'fetch']:
            if '--descriptor' in argv:
                return json.dumps({'digest': self.digest})
            digest = argv[-1].split('@')[1]
            return json.dumps(self.artifacts[digest])
        if argv[:2] == ['oras', 'pull']:
            if self.fail_pull:
                raise RuntimeError('injected pull failure')
            digest = argv[2].split('@')[1]
            version = self.artifacts[digest]['annotations']['org.opencontainers.image.version']
            bundle(Path(argv[-1]), version, name='wrong' if self.bad_bundle else 'demo')
            return ''
        if argv[:3] == ['claude', 'plugin', 'validate']:
            if self.fail_validation:
                raise RuntimeError('injected native validation failure')
            return '{}'
        if argv[:3] in (['claude', 'plugin', 'update'], ['claude', 'plugin', 'install']):
            if self.fail_native:
                raise RuntimeError('injected native activation failure')
            return '{}'
        self.testcase.fail('Unexpected subprocess: ' + repr(argv))


class ManagerCases(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.helper = manager.Manager(Path(self.temp.name) / 'profile')
        self.runner = FixtureRunner(self)
        self.helper.run = self.runner

    def materialize(self):
        self.helper.add('https://github.com/example/marketplace.git')
        return self.helper.marketplaces / 'demo-marketplace'

    def test_add_keeps_original_sources_and_materializes_native_paths(self):
        target = self.materialize()
        generated = json.loads((target / '.claude-plugin/marketplace.json').read_text())
        state = json.loads((target / manager.STATE_FILE).read_text())
        self.assertEqual(generated['name'], 'demo-marketplace')
        self.assertEqual(generated['plugins'][0]['source'], './.oci-plugins/demo')
        self.assertEqual(generated['plugins'][1]['source'], './standard')
        self.assertTrue((target / 'standard/.claude-plugin/plugin.json').is_file())
        self.assertEqual(state['gitSource'], 'https://github.com/example/marketplace.git')
        self.assertEqual(state['plugins']['demo']['source'], SOURCE)
        self.assertEqual(state['plugins']['demo']['digest'], DIGEST_V1)
        pulls = [call for call in self.runner.calls if call[:2] == ['oras', 'pull']]
        self.assertEqual(pulls[0][2], 'quay.io/example/demo@' + DIGEST_V1)
        self.assertEqual(len(self.runner.registrations), 1)

    def test_branch_url_is_cloned_at_ref_and_preserved_in_provenance(self):
        source = 'https://github.com/example/marketplace.git#demo-branch'
        self.helper.add(source)
        clone = next(call for call in self.runner.calls if call[:2] == ['git', 'clone'])
        self.assertEqual(clone[:-1], ['git', 'clone', '--depth', '1', '--branch', 'demo-branch',
                                     '--', 'https://github.com/example/marketplace.git'])
        target = self.helper.marketplaces / 'demo-marketplace'
        self.assertEqual(json.loads((target / manager.STATE_FILE).read_text())['gitSource'], source)
        self.assertEqual(self.helper.list()['marketplaces'][0]['source'], source)

    def test_mixed_standard_plugin_lists_and_installs_through_manager(self):
        self.materialize()
        self.runner.calls.clear()
        rows = {row['identity']: row for row in self.helper.list()['plugins']}
        self.assertEqual(rows[IDENTITY]['kind'], 'oci')
        standard = rows['standard@demo-marketplace']
        self.assertEqual(standard['kind'], 'standard')
        self.assertEqual(standard['version'], '1.0.0')
        self.helper.install('standard@demo-marketplace')
        self.assertIn(['claude', 'plugin', 'install', 'standard@demo-marketplace', '--scope', 'user', '--json'],
                      self.runner.calls)
        self.assertFalse(any(call[0] == 'oras' for call in self.runner.calls))
        with self.assertRaises(ValueError):
            self.helper.update('standard@demo-marketplace', DIGEST_V2, '2.0.0')

    def test_native_standard_marketplace_lists_installed_and_checks_no_oci(self):
        target = self.helper.config / 'native-standard'
        write_json(target / '.claude-plugin/marketplace.json', {
            'name': 'native-marketplace', 'plugins': [
                {'name': 'standard', 'description': 'Native plugin', 'source': './standard'}]})
        bundle(target / 'standard', name='standard')
        self.runner.registrations = [{'name': 'native-marketplace', 'installLocation': str(target),
                                      'url': 'https://github.com/example/native.git'}]
        identity = 'standard@native-marketplace'
        self.runner.installed = [{'id': identity, 'scope': 'user', 'version': '1.0.0'}]
        result = self.helper.list()
        self.assertEqual(result['marketplaces'][0]['classification'], 'standard-only')
        self.assertEqual(result['plugins'][0]['identity'], identity)
        self.assertTrue(result['plugins'][0]['installed'])
        self.assertEqual(self.helper.installed()['plugins'][0]['identity'], identity)
        self.assertEqual(self.helper.updates(), {'updates': [], 'errors': []})
        self.helper.install(identity)
        self.assertIn(['claude', 'plugin', 'install', identity, '--scope', 'user', '--json'], self.runner.calls)
        self.assertFalse(any(call[0] in ('oras', 'git') for call in self.runner.calls))

    def test_listing_is_local_and_recognizes_native_installs(self):
        self.materialize()
        self.runner.installed = [{'id': IDENTITY, 'scope': 'user', 'version': '1.0.0'}]
        self.runner.calls.clear()
        result = self.helper.list()
        self.assertEqual(len(result['marketplaces']), 1)
        self.assertTrue(result['plugins'][0]['installed'])
        self.assertEqual(result['plugins'][0]['identity'], IDENTITY)
        self.assertFalse(any(call[0] in ('oras', 'git') for call in self.runner.calls))
        self.assertEqual(len(self.helper.installed()['plugins']), 1)

    def test_claude_registrations_remain_authoritative(self):
        self.materialize()
        self.runner.registrations.clear()
        self.assertEqual(self.helper.list()['plugins'], [])
        self.assertEqual(self.helper.list()['marketplaces'], [])

    def test_standard_marketplace_add_uses_native_url_without_oras(self):
        self.runner.manifest['plugins'].pop(0)
        self.helper.add('https://github.com/example/standard.git')
        self.assertFalse(any(call[0] == 'oras' for call in self.runner.calls))
        adds = [call for call in self.runner.calls if call[:4] == ['claude', 'plugin', 'marketplace', 'add']]
        self.assertEqual(adds[0][4], 'https://github.com/example/standard.git')
        self.assertFalse((self.helper.marketplaces / 'demo-marketplace').exists())

    def test_failed_add_leaves_no_materialized_marketplace(self):
        for failure in ('fail_pull', 'bad_bundle', 'fail_native'):
            with self.subTest(failure=failure):
                setattr(self.runner, failure, True)
                with self.assertRaises((ValueError, RuntimeError)):
                    self.materialize()
                self.assertFalse((self.helper.marketplaces / 'demo-marketplace').exists())
                setattr(self.runner, failure, False)

    def snapshot(self, target):
        return {str(path.relative_to(target)): path.read_bytes()
                for path in target.rglob('*') if path.is_file()}

    def test_updates_checks_only_metadata_and_detects_same_version_digest_change(self):
        self.materialize()
        self.runner.digest = DIGEST_V2
        self.runner.artifacts[DIGEST_V2] = artifact('1.0.0')
        self.runner.calls.clear()
        result = self.helper.updates()
        self.assertEqual(result['errors'], [])
        self.assertEqual(result['updates'][0]['metadata']['digest'], DIGEST_V2)
        self.assertEqual(result['updates'][0]['installedVersion'], '1.0.0')
        self.assertTrue(all(call[:3] == ['oras', 'manifest', 'fetch']
                            for call in self.runner.calls if call[0] == 'oras'))

    def test_successful_update_uses_reviewed_digest_after_tag_moves(self):
        target = self.materialize()
        self.runner.installed = [{'id': IDENTITY, 'scope': 'user', 'version': '1.0.0'}]
        self.runner.digest = DIGEST_V1  # Tag differs from the approved replacement.
        self.runner.calls.clear()
        self.helper.update(IDENTITY, DIGEST_V2, '2.0.0')
        state = json.loads((target / manager.STATE_FILE).read_text())
        self.assertEqual(state['plugins']['demo']['digest'], DIGEST_V2)
        self.assertEqual(state['plugins']['demo']['version'], '2.0.0')
        self.assertEqual(json.loads((target / '.oci-plugins/demo/.claude-plugin/plugin.json').read_text())['version'], '2.0.0')
        manifest = json.loads((target / '.claude-plugin/marketplace.json').read_text())
        self.assertEqual(manifest['plugins'][1], self.runner.manifest['plugins'][1])
        self.assertTrue((target / 'standard/.claude-plugin/plugin.json').is_file())
        oras = [call for call in self.runner.calls if call[0] == 'oras']
        self.assertFalse(any('--descriptor' in call for call in oras))
        self.assertEqual([call[2] for call in oras if call[1] == 'pull'],
                         ['quay.io/example/demo@' + DIGEST_V2])
        self.assertIn(['claude', 'plugin', 'update', IDENTITY, '--scope', 'user', '--json'], self.runner.calls)

    def test_uninstalled_update_materializes_without_native_install(self):
        self.materialize()
        self.runner.calls.clear()
        self.helper.update(IDENTITY, DIGEST_V2, '2.0.0')
        self.assertFalse(any(call[:3] in (['claude', 'plugin', 'install'], ['claude', 'plugin', 'update'])
                             for call in self.runner.calls))

    def test_manager_install_uses_native_identity_and_user_scope(self):
        self.materialize()
        self.runner.calls.clear()
        self.helper.install(IDENTITY)
        self.assertIn(['claude', 'plugin', 'install', IDENTITY, '--scope', 'user', '--json'], self.runner.calls)
        self.assertFalse(any(call[0] == 'oras' for call in self.runner.calls))

    def test_failed_updates_preserve_working_files_and_recorded_digest(self):
        target = self.materialize()
        self.runner.installed = [{'id': IDENTITY, 'scope': 'user', 'version': '1.0.0'}]
        previous = self.snapshot(target)
        for failure in ('fail_pull', 'bad_bundle', 'fail_validation', 'fail_native'):
            with self.subTest(failure=failure):
                setattr(self.runner, failure, True)
                with self.assertRaises((ValueError, RuntimeError)):
                    self.helper.update(IDENTITY, DIGEST_V2, '2.0.0')
                self.assertEqual(self.snapshot(target), previous)
                setattr(self.runner, failure, False)
        for digest, version in [('sha256:bad', '2.0.0'), (DIGEST_V2, 'unapproved-version')]:
            with self.subTest(digest=digest, version=version):
                with self.assertRaises(ValueError):
                    self.helper.update(IDENTITY, digest, version)
                self.assertEqual(self.snapshot(target), previous)

    def test_failed_metadata_lookup_does_not_touch_working_bundle(self):
        target = self.materialize()
        previous = self.snapshot(target)
        for invalid in [artifact(name='another'), dict(artifact(), artifactType='unsupported')]:
            with self.subTest(artifact=invalid):
                self.runner.artifacts[DIGEST_V2] = invalid
                with self.assertRaises(ValueError):
                    self.helper.update(IDENTITY, DIGEST_V2, '1.0.0')
                self.assertEqual(self.snapshot(target), previous)
        self.runner.digest = DIGEST_V2
        result = self.helper.updates()
        self.assertEqual(result['updates'], [])
        self.assertTrue(result['errors'])
        self.assertEqual(self.snapshot(target), previous)

    def test_native_partial_change_is_recovered_against_restored_bundle(self):
        target = self.materialize()
        self.runner.installed = [{'id': IDENTITY, 'scope': 'user', 'version': '1.0.0'}]
        previous = self.snapshot(target)
        original = self.runner
        attempts = []

        def partial_native_change(argv, cwd=None):
            if argv[:3] == ['claude', 'plugin', 'update']:
                version = json.loads((target / '.oci-plugins/demo/.claude-plugin/plugin.json').read_text())['version']
                attempts.append(version)
                original.installed[0]['version'] = version
                if len(attempts) == 1:
                    raise RuntimeError('native update failed after changing installation')
                return '{}'
            return original(argv, cwd)

        self.helper.run = partial_native_change
        with self.assertRaisesRegex(RuntimeError, 'previous plugin and digest restored'):
            self.helper.update(IDENTITY, DIGEST_V2, '2.0.0')
        self.assertEqual(attempts, ['2.0.0', '1.0.0'])
        self.assertEqual(self.runner.installed[0]['version'], '1.0.0')
        self.assertEqual(self.snapshot(target), previous)

    def test_native_recovery_failure_is_reported_and_bundle_restored(self):
        target = self.materialize()
        self.runner.installed = [{'id': IDENTITY, 'scope': 'user', 'version': '1.0.0'}]
        previous = self.snapshot(target)
        original = self.runner

        def fail_after_native_change(argv, cwd=None):
            if argv[:3] == ['claude', 'plugin', 'update']:
                original.installed[0]['version'] = '2.0.0'
                raise RuntimeError('native update failed after changing installation')
            return original(argv, cwd)

        self.helper.run = fail_after_native_change
        with self.assertRaisesRegex(RuntimeError, 'native recovery failed'):
            self.helper.update(IDENTITY, DIGEST_V2, '2.0.0')
        self.assertEqual(self.snapshot(target), previous)

    def test_inspect_is_metadata_only_and_reads_resolved_digest(self):
        result = self.helper.inspect(SOURCE)
        self.assertEqual(result['digest'], DIGEST_V1)
        self.assertEqual(result['version'], '1.0.0')
        self.assertEqual(self.runner.calls, [
            ['oras', 'manifest', 'fetch', '--descriptor', SOURCE],
            ['oras', 'manifest', 'fetch', 'quay.io/example/demo@' + DIGEST_V1]])

    def test_rejects_unsupported_artifact_contracts(self):
        mutations = [lambda doc: doc.update(artifactType='wrong'),
                     lambda doc: doc['layers'][0].update(mediaType='wrong'),
                     lambda doc: doc['layers'][0]['annotations'].clear(),
                     lambda doc: doc['annotations'].pop('org.opencontainers.image.title'),
                     lambda doc: doc['annotations'].pop('org.opencontainers.image.version')]
        for mutate in mutations:
            with self.subTest(mutation=mutate):
                document = artifact()
                mutate(document)
                self.runner.artifacts[DIGEST_V1] = document
                with self.assertRaises(ValueError):
                    self.helper.inspect(SOURCE)


class ProcessBoundary(unittest.TestCase):
    def test_run_uses_argv_and_existing_credentials_environment(self):
        with patch.object(manager.subprocess, 'run', return_value=SimpleNamespace(
                returncode=0, stdout='result', stderr='')) as process:
            env = {'CLAUDE_CONFIG_DIR': '/isolated/profile', 'DOCKER_CONFIG': '/existing/credentials'}
            self.assertEqual(manager.run(['oras', 'manifest', 'fetch', SOURCE], env=env), 'result')
        self.assertEqual(process.call_args.args[0], ['oras', 'manifest', 'fetch', SOURCE])
        self.assertEqual(process.call_args.kwargs['env'], env)
        self.assertNotIn('shell', process.call_args.kwargs)

    def test_registry_error_does_not_expose_signed_redirect_queries(self):
        failure = SimpleNamespace(returncode=1, stdout='',
                                  stderr='GET https://cdn.example.invalid/blob?token=secret failed')
        with patch.object(manager.subprocess, 'run', return_value=failure):
            with self.assertRaises(RuntimeError) as error:
                manager.run(['oras', 'pull', SOURCE])
        self.assertNotIn('token=secret', str(error.exception))
        self.assertIn('https://cdn.example.invalid/blob', str(error.exception))


class Sources(unittest.TestCase):
    def test_tagged_reference_and_registry_port(self):
        self.assertEqual(manager.parse_reference(SOURCE), ('quay.io/example/demo', 'latest'))
        self.assertEqual(manager.parse_reference('localhost:5000/team/demo:v2'),
                         ('localhost:5000/team/demo', 'v2'))

    def test_rejects_non_tagged_and_unsafe_references(self):
        for source in ['oci://' + SOURCE, 'quay.io/example/demo', SOURCE + ' ',
                       'quay.io/example/demo@' + DIGEST_V1, 'quay.io/example/../demo:latest']:
            with self.subTest(source=source), self.assertRaises((ValueError, RuntimeError)):
                manager.parse_reference(source)


class MarketplaceSources(unittest.TestCase):
    def test_mixed_sources_select_only_oci_plugins(self):
        oci = {'name': 'demo', 'description': 'Demo plugin', 'source': SOURCE}
        native = [{'name': 'local', 'source': './plugins/local'},
                  {'name': 'remote', 'source': {'source': 'github', 'repo': 'example/remote'}},
                  {'name': 'git', 'source': 'https://github.com/example/git.git'}]
        self.assertEqual(manager.oci_plugins({'name': 'mixed', 'plugins': [oci, *native]}), [oci])

    def test_invalid_oci_entries_are_errors_not_silently_standard(self):
        variants = [dict(name='demo', description='Demo', source='oci://' + SOURCE),
                    dict(name='demo', description='Demo', source='quay.io/example/demo'),
                    dict(name='demo', source=SOURCE),
                    dict(name='../demo', description='Demo', source=SOURCE)]
        for entry in variants:
            with self.subTest(entry=entry), self.assertRaises(ValueError):
                manager.oci_plugins({'name': 'demo-marketplace', 'plugins': [entry]})

    def test_duplicate_plugin_identity_is_rejected(self):
        entry = dict(name='demo', description='Demo', source=SOURCE)
        with self.assertRaises(ValueError):
            manager.oci_plugins({'name': 'demo-marketplace', 'plugins': [entry, dict(entry)]})


class Bundles(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        bundle(self.root)

    def test_complete_plugin_has_matching_identity_and_version(self):
        manager.validate_bundle(self.root, 'demo', '1.0.0')

    def test_mismatched_name_and_version_rejected(self):
        for name, version in [('another', '1.0.0'), ('demo', '2.0.0')]:
            with self.subTest(name=name, version=version), self.assertRaises((ValueError, RuntimeError)):
                manager.validate_bundle(self.root, name, version)

    def test_missing_manifest_rejected(self):
        (self.root / '.claude-plugin' / 'plugin.json').unlink()
        with self.assertRaises((ValueError, RuntimeError, OSError)):
            manager.validate_bundle(self.root, 'demo', '1.0.0')

    def test_bundle_cannot_escape_through_a_symlink(self):
        external = self.root.parent / (self.root.name + '-outside')
        external.write_text('outside content')
        self.addCleanup(external.unlink)
        (self.root / 'outside').symlink_to(external)
        with self.assertRaises((ValueError, RuntimeError)):
            manager.validate_bundle(self.root, 'demo', '1.0.0')


if __name__ == '__main__':
    unittest.main()
