import { expect, test } from 'claude-code/testing'
import {
  catalogsFromRegistrations,
  identityFor,
  installDirectoryName,
  parseInspection,
  parseOciReference,
  shellQuote,
  validateCatalog,
  validateInstalledState,
} from '../hooks/lib.js'

const goodSkill = {
  name: 'claude-oci-demo',
  description: 'A sample OCI skill',
  repository: 'quay.io/example/claude-oci-demo:1.0.0',
}

test('validates the minimum catalog fields and tagged OCI reference', async () => {
  const skills = validateCatalog({ skills: [goodSkill] }, 'marketplace-one')
  expect(skills[0].identity).toBe('claude-oci-demo@marketplace-one')
  expect(skills[0].registry).toBe('quay.io')
  expect(skills[0].tag).toBe('1.0.0')
  expect(parseOciReference('localhost:5000/team/skill:release_2').registry).toBe('localhost:5000')
})

test('rejects duplicate names in one catalog and allows the same name across marketplaces', async () => {
  expect(() => validateCatalog({ skills: [goodSkill, goodSkill] }, 'marketplace-one')).toThrow(/duplicate skill name/)
  const registrations = [
    { name: 'marketplace-one', installLocation: '/tmp/marketplace-one' },
    { name: 'marketplace-two', installLocation: '/tmp/marketplace-two' },
  ]
  const loaded = await catalogsFromRegistrations(registrations, async () => JSON.stringify({ skills: [goodSkill] }))
  const identities = loaded.catalogs.flatMap((catalog) => catalog.skills.map((skill) => skill.identity))
  expect(identities).toEqual(['claude-oci-demo@marketplace-one', 'claude-oci-demo@marketplace-two'])
  expect(identities[0]).not.toBe(identities[1])
})

test('enforces every required skill field and rejects digest-only or malformed references', async () => {
  for (const field of ['name', 'description', 'repository']) {
    const skill = { ...goodSkill, [field]: '  ' }
    expect(() => validateCatalog({ skills: [skill] }, 'marketplace-one')).toThrow(new RegExp(`\\.${field} must be a non-empty string`))
  }
  expect(() => parseOciReference('quay.io/example/skill')).toThrow(/registry, path, and tag/)
  expect(() => parseOciReference('quay.io/example/skill@sha256:abcdef')).toThrow(/tagged OCI image reference/)
  expect(() => validateCatalog({ skills: 'invalid' }, 'marketplace-one')).toThrow(/skills must be an array/)
  expect(() => validateCatalog({ skills: [{ ...goodSkill, name: '../outside' }] }, 'marketplace-one')).toThrow(/path-safe name/)
})

test('standard-only marketplaces add no OCI entries', async () => {
  const registrations = [
    { name: 'oci-enabled', installLocation: '/tmp/oci-enabled' },
    { name: 'standard-only', installLocation: '/tmp/standard-only' },
  ]
  const loaded = await catalogsFromRegistrations(registrations, async (registration) =>
    registration.name === 'standard-only' ? undefined : JSON.stringify({ skills: [goodSkill] }),
  )
  expect(loaded.catalogs).toHaveLength(1)
  expect(loaded.catalogs[0].marketplace).toBe('oci-enabled')
  expect(loaded.errors).toEqual([])
})

test('keeps catalog tag, SkillCard version, and resolved digest separate', async () => {
  const output = [
    'Skill:        quay.io/example/claude-oci-demo',
    'Version:      0.1.1',
    `Digest:       sha256:${'3e'.repeat(32)}`,
    'Layers:       1',
  ].join('\n')
  const reference = parseOciReference(goodSkill.repository)
  const metadata = parseInspection(output)
  expect(reference.tag).toBe('1.0.0')
  expect(metadata.version).toBe('0.1.1')
  expect(metadata.digest).toBe(`sha256:${'3e'.repeat(32)}`)
  expect(() => parseInspection('Version: 1.0.0')).toThrow(/sha256 digest/)
})

test('validates installed records and keeps only the supported state fields', async () => {
  const digest = `sha256:${'c'.repeat(64)}`
  const record = {
    name: 'guide',
    marketplace: 'marketplace-one',
    repository: 'quay.io/example/guide:1.2.0',
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
    repository: record.repository,
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

test('encodes marketplace-qualified install directories and quotes shell arguments', async () => {
  expect(identityFor('guide', 'marketplace one')).toBe('guide@marketplace one')
  expect(installDirectoryName('guide', 'marketplace one')).toBe('guide@marketplace%20one')
  expect(shellQuote("a'b")).toBe("'a'\"'\"'b'")
})
