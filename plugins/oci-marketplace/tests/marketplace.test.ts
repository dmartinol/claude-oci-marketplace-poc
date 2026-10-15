import { expect, test } from 'claude-code/testing'
import {
  artifactsFromRegistrations,
  identityFor,
  installDirectoryName,
  parseInspection,
  parseMarketplacePlugins,
  parseOciReference,
  runProcess,
  shellQuote,
  validateInstalledState,
  validateMarketplacePlugins,
} from '../hooks/lib.js'

const goodPlugin = {
  name: 'claude-oci-demo',
  description: 'A sample OCI skill',
  source: 'quay.io/example/claude-oci-demo:1.0.0',
}

test('parses raw tagged OCI sources from marketplace plugins', async () => {
  const artifacts = validateMarketplacePlugins({ plugins: [goodPlugin] }, 'marketplace-one')
  expect(artifacts[0]).toEqual({
    name: goodPlugin.name,
    description: goodPlugin.description,
    source: goodPlugin.source,
    marketplace: 'marketplace-one',
    identity: 'claude-oci-demo@marketplace-one',
    installDirectory: 'claude-oci-demo@marketplace-one',
    registry: 'quay.io',
    tag: '1.0.0',
  })
  expect(parseOciReference('localhost:5000/team/skill:release_2').registry).toBe('localhost:5000')
})

test('ignores standard plugin sources while preserving OCI marketplace entries', async () => {
  const artifacts = validateMarketplacePlugins({ plugins: [
    goodPlugin,
    { name: 'local-plugin', description: 'Local plugin', source: './plugins/local' },
    { name: 'github-plugin', description: 'GitHub plugin', source: { source: 'github', repo: 'example/remote' } },
    { name: 'git-url-plugin', description: 'Git URL plugin', source: 'https://example.invalid/plugin.git' },
    { name: 'github-shorthand-plugin', description: 'GitHub shorthand', source: 'github:example/plugin' },
  ] }, 'mixed-marketplace')
  expect(artifacts.map((artifact) => artifact.identity)).toEqual(['claude-oci-demo@mixed-marketplace'])
  expect(validateMarketplacePlugins({ plugins: [{ name: 'standard', source: './plugins/standard' }] }, 'standard-only')).toEqual([])
})

test('reports invalid OCI sources without hiding valid sibling entries', async () => {
  const parsed = parseMarketplacePlugins({ plugins: [
    { name: 'valid', description: 'Valid OCI entry', source: 'quay.io/example/valid:1.0.0' },
    { name: 'missing-tag', description: 'Invalid OCI entry', source: 'quay.io/example/missing-tag' },
    { name: 'prefixed', description: 'OCI scheme is forbidden', source: 'oci://quay.io/example/prefixed:1.0.0' },
  ] }, 'marketplace-one')
  expect(parsed.artifacts.map((artifact) => artifact.identity)).toEqual(['valid@marketplace-one'])
  expect(parsed.errors).toHaveLength(2)
  expect(() => validateMarketplacePlugins({ plugins: [
    { name: 'missing-description', source: 'quay.io/example/skill:1.0.0' },
  ] }, 'marketplace-one')).toThrow(/description must be a non-empty string/)
  expect(() => validateMarketplacePlugins({ plugins: [
    { name: 'duplicate', description: 'first', source: 'quay.io/example/first:1.0.0' },
    { name: 'duplicate', description: 'second', source: 'quay.io/example/second:1.0.0' },
  ] }, 'marketplace-one')).toThrow(/duplicate OCI plugin name/)
  expect(() => parseOciReference('quay.io/example/skill')).toThrow(/registry, path, and tag/)
  expect(() => parseOciReference('quay.io/example/skill@sha256:abcdef')).toThrow(/tagged OCI image reference/)
  expect(() => validateMarketplacePlugins({ plugins: 'invalid' }, 'marketplace-one')).toThrow(/marketplace.plugins must be an array/)
  expect(() => validateMarketplacePlugins({ plugins: [
    { ...goodPlugin, name: '../outside' },
  ] }, 'marketplace-one')).toThrow(/path-safe name/)
})

test('discovers source entries across registered marketplaces and separates standard-only marketplaces', async () => {
  const registrations = [
    { name: 'source-marketplace', installLocation: '/tmp/source-marketplace' },
    { name: 'standard-only', installLocation: '/tmp/standard-only' },
    { name: 'mixed-marketplace', installLocation: '/tmp/mixed-marketplace' },
    { name: 'second-source-marketplace', installLocation: '/tmp/second-source-marketplace' },
  ]
  const manifests: Record<string, string> = {
    'source-marketplace': JSON.stringify({ plugins: [{ ...goodPlugin, name: 'demo' }] }),
    'standard-only': JSON.stringify({ plugins: [{ name: 'standard', description: 'Standard plugin', source: './plugins/standard' }] }),
    'mixed-marketplace': JSON.stringify({ plugins: [
      { name: 'native', description: 'Native plugin', source: './plugins/native' },
      { name: 'mixed', description: 'Mixed OCI plugin', source: 'quay.io/example/mixed:2.0.0' },
    ] }),
    'second-source-marketplace': JSON.stringify({ plugins: [{ ...goodPlugin, name: 'demo' }] }),
  }
  const loaded = await artifactsFromRegistrations(registrations, async (registration) => manifests[registration.name])
  expect(loaded.artifacts.map((artifact) => artifact.identity)).toEqual([
    'demo@source-marketplace',
    'mixed@mixed-marketplace',
    'demo@second-source-marketplace',
  ])
  expect(loaded.artifacts[0].source).toBe(goodPlugin.source)
  expect(loaded.errors).toEqual([])
})

test('keeps source tag, SkillCard version, and resolved digest separate', async () => {
  const output = [
    'Skill:        quay.io/example/claude-oci-demo',
    'Version:      0.1.1',
    `Digest:       sha256:${'3e'.repeat(32)}`,
    'Layers:       1',
  ].join('\n')
  const reference = parseOciReference(goodPlugin.source)
  const metadata = parseInspection(output)
  expect(reference.tag).toBe('1.0.0')
  expect(metadata.version).toBe('0.1.1')
  expect(metadata.digest).toBe(`sha256:${'3e'.repeat(32)}`)
  expect(() => parseInspection('Version: 1.0.0')).toThrow(/sha256 digest/)
})

test('validates installed source records and keeps only supported state fields', async () => {
  const digest = `sha256:${'c'.repeat(64)}`
  const record = {
    name: 'guide',
    marketplace: 'marketplace-one',
    source: 'quay.io/example/guide:1.2.0',
    registry: 'quay.io',
    version: '1.1.0',
    digest,
    installDirectory: 'guide@marketplace-one',
    installedAt: '2026-10-14T00:00:00.000Z',
    token: 'must not be retained',
  }
  const validated = validateInstalledState({ 'guide@marketplace-one': record })
  expect(validated.errors).toEqual([])
  expect(validated.entries['guide@marketplace-one']).toEqual({
    name: record.name,
    marketplace: record.marketplace,
    source: record.source,
    registry: record.registry,
    version: record.version,
    digest,
    installDirectory: record.installDirectory,
    installedAt: record.installedAt,
  })

  const invalid = validateInstalledState({ 'wrong-identity': record })
  expect(invalid.entries).toEqual({})
  expect(invalid.errors[0]).toMatch(/identity/)
})

test('bounds process calls and surfaces nonzero exits and timeouts', async () => {
  const calls: Array<{ argv: string[]; timeoutMs: number }> = []
  const output = await runProcess(async (argv: string[], options: { timeoutMs: number }) => {
    calls.push({ argv, timeoutMs: options.timeoutMs })
    return { exitCode: 0, stdout: 'metadata', stderr: '' }
  }, ['skillctl', 'inspect', 'quay.io/example/guide:1.2.0'], 60000)
  expect(output).toBe('metadata')
  expect(calls).toEqual([{ argv: ['skillctl', 'inspect', 'quay.io/example/guide:1.2.0'], timeoutMs: 60000 }])

  let exitError = ''
  try {
    await runProcess(async () => ({ exitCode: 9, stdout: '', stderr: 'registry denied' }), ['skillctl', 'inspect', 'quay.io/example/guide:1.2.0'])
  } catch (error) {
    exitError = error instanceof Error ? error.message : String(error)
  }
  expect(exitError).toBe('registry denied')

  let timeoutError = ''
  try {
    await runProcess(async (_argv: string[], options: { timeoutMs: number }) => {
      if (options.timeoutMs !== 60000) throw new Error('timeout was not configured')
      throw new Error('process timed out after 60000ms')
    }, ['skillctl', 'inspect', 'quay.io/example/guide:1.2.0'], 60000)
  } catch (error) {
    timeoutError = error instanceof Error ? error.message : String(error)
  }
  expect(timeoutError).toBe('process timed out after 60000ms')
})

test('encodes marketplace-qualified install directories and quotes shell arguments', async () => {
  expect(identityFor('guide', 'marketplace one')).toBe('guide@marketplace one')
  expect(installDirectoryName('guide', 'marketplace one')).toBe('guide@marketplace%20one')
  expect(shellQuote("a'b")).toBe("'a'\"'\"'b'")
})
