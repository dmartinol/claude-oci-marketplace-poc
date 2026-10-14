const REPOSITORY_PATH = /^[a-z0-9]+(?:[._-][a-z0-9]+)*(?:\/[a-z0-9]+(?:[._-][a-z0-9]+)*)*$/
const TAG = /^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$/

function validateName(name, label) {
  if (typeof name !== 'string' || name.trim() === '' || name === '.' || name === '..' || /[\\/\x00-\x1f\x7f]/.test(name)) {
    throw new Error(`${label} must be a non-empty path-safe name`)
  }
}

export function identityFor(name, marketplace) {
  return `${name}@${marketplace}`
}

export function installDirectoryName(name, marketplace) {
  return `${encodeURIComponent(name)}@${encodeURIComponent(marketplace)}`
}

export function parseOciReference(reference) {
  if (typeof reference !== 'string' || reference.trim() !== reference) {
    throw new Error('repository must be a tagged OCI image reference')
  }

  const slash = reference.indexOf('/')
  const colon = reference.lastIndexOf(':')
  if (slash < 1 || colon <= slash + 1 || colon === reference.length - 1) {
    throw new Error(`repository must include a registry, path, and tag: ${reference}`)
  }

  const registry = reference.slice(0, slash)
  const repository = reference.slice(slash + 1, colon)
  const tag = reference.slice(colon + 1)
  if (!/^[A-Za-z0-9.-]+(?::[0-9]{1,5})?$/.test(registry) ||
      !REPOSITORY_PATH.test(repository) || !TAG.test(tag)) {
    throw new Error(`invalid tagged OCI image reference: ${reference}`)
  }

  return { registry, repository, tag }
}

export function validateCatalog(value, marketplaceName) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('catalog must be a JSON object')
  }
  validateName(marketplaceName, 'registered marketplace name')
  if (!Array.isArray(value.skills)) {
    throw new Error('catalog.skills must be an array')
  }

  const names = new Set()
  return value.skills.map((skill, index) => {
    if (!skill || typeof skill !== 'object' || Array.isArray(skill)) {
      throw new Error(`catalog.skills[${index}] must be an object`)
    }
    for (const key of ['name', 'description', 'repository']) {
      if (typeof skill[key] !== 'string' || skill[key].trim() === '') {
        throw new Error(`catalog.skills[${index}].${key} must be a non-empty string`)
      }
    }
    validateName(skill.name, `catalog.skills[${index}].name`)
    if (names.has(skill.name)) {
      throw new Error(`duplicate skill name in catalog: ${skill.name}`)
    }
    names.add(skill.name)
    const reference = parseOciReference(skill.repository)
    return {
      name: skill.name,
      description: skill.description.trim(),
      repository: skill.repository,
      marketplace: marketplaceName,
      identity: identityFor(skill.name, marketplaceName),
      installDirectory: installDirectoryName(skill.name, marketplaceName),
      registry: reference.registry,
      tag: reference.tag,
    }
  })
}

export async function catalogsFromRegistrations(registrations, readCatalog) {
  if (!Array.isArray(registrations)) {
    throw new Error('Claude marketplace list did not return an array')
  }
  const catalogs = []
  const errors = []
  for (const registration of registrations) {
    if (typeof registration?.name !== 'string' || typeof registration?.installLocation !== 'string') {
      errors.push('Claude returned a marketplace without a name or installLocation')
      continue
    }
    try {
      const text = await readCatalog(registration)
      if (text === undefined || text === null) continue
      const skills = validateCatalog(JSON.parse(text), registration.name)
      catalogs.push({ marketplace: registration.name, installLocation: registration.installLocation, skills })
    } catch (error) {
      errors.push(`${registration.name}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  return { catalogs, errors }
}

export function parseInspection(output) {
  const fields = Object.fromEntries(
    output.split(/\r?\n/).map((line) => {
      const match = line.match(/^\s*([^:]+):\s*(.*?)\s*$/)
      return match ? [match[1].trim().toLowerCase(), match[2]] : []
    }).filter((pair) => pair.length === 2),
  )
  const version = fields.version
  const digest = fields.digest
  if (!version || !/^sha256:[a-f0-9]{64}$/.test(digest || '')) {
    throw new Error('skillctl inspect output did not include a version and sha256 digest')
  }
  return { version, digest }
}

export function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\"'\"'")}'`
}

export function validateUnpackedSkill(files, skillMd, expectedName) {
  if (!files.includes('SKILL.md') || !files.includes('skill.yaml')) {
    throw new Error('artifact must contain both SKILL.md and skill.yaml at its root')
  }
  const frontmatter = skillMd.match(/^---\s*\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)
  const name = frontmatter?.[1].match(/^name:\s*([^\r\n#]+)\s*$/m)?.[1]?.trim()
  if (name !== expectedName) {
    throw new Error(`SKILL.md name must be ${expectedName}`)
  }
  if (!/^description:\s*\S/m.test(frontmatter[1])) {
    throw new Error('SKILL.md frontmatter must include a description')
  }
}
