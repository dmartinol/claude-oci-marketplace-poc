import {
  catalogsFromRegistrations,
  identityFor,
  installDirectoryName,
  marketplacesFromRegistrations,
  parseInspection,
  runProcess,
  shellQuote,
  validateInstalledState,
} from './lib.js'

const STORE_KEY = 'installedSkills'
const DISMISS_KEY = 'dismissedSessionId'
const CATALOG_FILE = 'oci-catalog.json'
const COMMAND_NAME = 'marketplace-manager'

function errorText(error) {
  return error instanceof Error ? error.message : String(error)
}

function usage() {
  return [
    'Claude Marketplace Manager',
    '',
    'Commands:',
    '  /marketplace-manager list',
    '  /marketplace-manager add <source>',
    '  /marketplace-manager browse  (OCI-enabled marketplaces only)',
    '  /marketplace-manager install <skill@marketplace>',
    '  /marketplace-manager updates',
    '  /marketplace-manager installed',
    '',
    'Standard marketplace plugins remain available through Claude’s /plugin interface.',
  ].join('\n')
}

async function readInstalled($) {
  const value = await $.store.get(STORE_KEY)
  const { entries, errors } = validateInstalledState(value ?? {})
  for (const error of errors) $.ui.log(`Ignoring invalid installed-skill record: ${error}`, { to: 'debug' })
  return entries
}

async function alertsDismissed($) {
  const sessionId = await $.session.id()
  return (await $.store.get(DISMISS_KEY)) === sessionId
}

async function dismissAlerts($) {
  await $.store.set(DISMISS_KEY, await $.session.id())
}

async function registeredMarketplaces($) {
  const output = await runProcess((argv, options) => $.process.run(argv, options), ['claude', 'plugin', 'marketplace', 'list', '--json'])
  const registrations = JSON.parse(output)
  if (!Array.isArray(registrations)) throw new Error('Claude marketplace list did not return an array')
  return registrations
}

async function registeredCatalogs($, registrations = undefined) {
  registrations ??= await registeredMarketplaces($)
  return catalogsFromRegistrations(registrations, async (registration) => {
    const catalogPath = `${registration.installLocation}/${CATALOG_FILE}`
    if (!(await $.fs.exists(catalogPath))) return undefined
    return $.fs.read(catalogPath)
  })
}

function formatMarketplaces(marketplaces) {
  if (marketplaces.length === 0) return 'No Claude marketplaces are registered.'
  return [
    'Registered Claude marketplaces:',
    ...marketplaces.map((marketplace) => `- ${marketplace.name} | ${marketplace.source} | ${marketplace.classification}`),
    '',
    'Use /plugin to browse and install standard marketplace plugins.',
    'Use /marketplace-manager browse for OCI skills from OCI-enabled marketplaces.',
  ].join('\n')
}

async function listMarketplaces($, registrations = undefined) {
  registrations ??= await registeredMarketplaces($)
  const marketplaces = await marketplacesFromRegistrations(registrations, async (registration) =>
    $.fs.exists(`${registration.installLocation}/${CATALOG_FILE}`),
  )
  return formatMarketplaces(marketplaces)
}

async function inspectSkill($, skill) {
  const output = await runProcess((argv, options) => $.process.run(argv, options), ['skillctl', 'inspect', skill.repository], 60000)
  return parseInspection(output)
}

function flattenCatalogs(catalogs) {
  return catalogs.flatMap((catalog) => catalog.skills.map((skill) => ({
    ...skill,
    marketplace: catalog.marketplace,
    installLocation: catalog.installLocation,
  })))
}

async function inspectedEntries($, entries) {
  return Promise.all(entries.map(async (skill) => {
    try {
      return { skill, metadata: await inspectSkill($, skill) }
    } catch (error) {
      return { skill, error: errorText(error) }
    }
  }))
}

function lineFor(skill, metadata, installed) {
  const installedText = installed
    ? `installed v${installed.version} (${installed.digest})`
    : 'not installed'
  if (!metadata) return `- ${skill.identity}: metadata check failed; ${installedText}`
  return `- ${skill.identity}: ${skill.description} | v${metadata.version} | ${skill.registry} | ${metadata.digest} | ${installedText}`
}

function formatListing(checked, errors, installed) {
  const lines = ['OCI skills from registered marketplaces:']
  for (const item of checked) {
    lines.push(lineFor(item.skill, item.metadata, installed[item.skill.identity]))
    if (item.error) lines.push(`  Metadata error: ${item.error}`)
  }
  for (const error of errors) lines.push(`- Catalog error: ${error}`)
  return lines.join('\n')
}

async function checkInstalledUpdates($) {
  const { catalogs, errors: catalogErrors } = await registeredCatalogs($)
  const entries = flattenCatalogs(catalogs)
  const installed = await readInstalled($)
  const matching = entries.filter((skill) => installed[skill.identity])
  const checked = await inspectedEntries($, matching)
  const inspectErrors = checked.flatMap(({ skill, error }) => error ? [`${skill.identity}: ${error}`] : [])
  const updates = checked.flatMap(({ skill, metadata, error }) => {
    const prior = installed[skill.identity]
    if (!metadata || metadata.digest === prior.digest) return []
    return [{ ...skill, metadata, installed: prior, inspectError: error }]
  })
  return { updates, errors: [...catalogErrors, ...inspectErrors], installed, catalogs }
}

async function announceUpdates($) {
  try {
    if (await alertsDismissed($)) return
    const { updates, errors } = await checkInstalledUpdates($)
    for (const error of errors) $.ui.log(`OCI Marketplace startup check: ${error}`, { to: 'debug' })
    if (updates.length) {
      $.ui.toast(`${updates.length} OCI skill update${updates.length === 1 ? '' : 's'} available. Run /marketplace-manager updates to review.`, { timeoutMs: 10000 })
    }
  } catch (error) {
    $.ui.log(`OCI Marketplace startup check failed: ${errorText(error)}`, { to: 'debug' })
  }
}

async function browse($) {
  const { catalogs, errors } = await registeredCatalogs($)
  const entries = flattenCatalogs(catalogs)
  if (entries.length === 0 && errors.length === 0) {
    return 'No registered marketplaces contain an OCI catalog. Standard marketplace plugins remain available through /plugin. Run /marketplace-manager list to see every registered marketplace.'
  }

  const installed = await readInstalled($)
  const checked = await inspectedEntries($, entries)
  const listing = formatListing(checked, errors, installed)
  const selected = await chooseSkill($, checked)
  if (!selected) return `${listing}\n\nNo skill selected.`
  if (selected.error) return `${listing}\n\n${selected.skill.identity}: metadata check failed: ${selected.error}`
  const installedSkill = installed[selected.skill.identity]
  if (installedSkill?.digest === selected.metadata.digest) {
    return `${listing}\n\n${selected.skill.identity} is already installed at v${installedSkill.version}.`
  }
  const intent = installedSkill ? 'update' : 'install'
  const result = await promptInstall($, selected.skill, selected.metadata, intent)
  const refreshedListing = formatListing(checked, errors, await readInstalled($))
  return `${refreshedListing}\n\n${result}`
}

async function chooseSkill($, checked) {
  for (let offset = 0; offset < checked.length; offset += 3) {
    const page = checked.slice(offset, offset + 3)
    const hasMore = offset + page.length < checked.length
    const options = page.map(({ skill }) => skill.identity)
    options.push(hasMore ? 'More…' : 'Done')
    let answer
    try {
      answer = await $.ui.ask('Choose an OCI skill to install or update.', {
        header: 'OCI skills',
        options,
      })
    } catch {
      return undefined
    }
    if (answer === 'Done') return undefined
    if (answer === 'More…') continue
    return page.find(({ skill }) => skill.identity === answer)
  }
  return undefined
}

async function showInstalled($) {
  const installed = await readInstalled($)
  const entries = Object.values(installed)
  if (entries.length === 0) return 'No OCI skills are installed yet. Run /marketplace-manager browse.'
  return [
    'Installed OCI skills:',
    ...entries.map((item) => `- ${identityFor(item.name, item.marketplace)}: v${item.version} | ${item.registry} | ${item.digest}`),
  ].join('\n')
}

async function performInstall($, skill, metadata, intent) {
  const home = await $.env.get('HOME')
  if (!home || !home.startsWith('/')) throw new Error('Could not resolve the user home directory')
  const configuredRoot = await $.env.get('CLAUDE_CONFIG_DIR')
  if (configuredRoot && (typeof configuredRoot !== 'string' || !configuredRoot.startsWith('/'))) {
    throw new Error('CLAUDE_CONFIG_DIR must be an absolute path when set')
  }
  const configRoot = configuredRoot
    ? configuredRoot.replace(/\/+$/, '') || '/'
    : `${home}/.claude`
  const skillsRoot = configRoot === '/' ? '/skills' : `${configRoot}/skills`
  const timestamp = String(await $.clock.now()).replace(/[^0-9]/g, '')
  const installDirectory = installDirectoryName(skill.name, skill.marketplace)
  const stageRoot = `${skillsRoot}/.oci-marketplace-stage-${timestamp}-${installDirectory}`
  const target = `${skillsRoot}/${installDirectory}`
  const backup = `${skillsRoot}/.oci-marketplace-backup-${timestamp}-${installDirectory}`
  const command = [
    shellQuote(`${$.plugin.root}/hooks/install.sh`),
    shellQuote(skill.repository),
    shellQuote(metadata.digest),
    shellQuote(skill.name),
    shellQuote(stageRoot),
    shellQuote(target),
    shellQuote(backup),
  ].join(' ')

  $.ui.status(`Waiting for permission to ${intent} ${skill.identity}…`)
  try {
    const call = await $.tool.call({
      tool: 'Bash',
      command,
      description: `${intent === 'update' ? 'Update' : 'Install'} OCI skill ${skill.identity}`,
    })
    if (call.deny) throw new Error(call.deny)
    if (call.isError) throw new Error(call.text || `Claude could not ${intent} the skill`)

    const installed = await readInstalled($)
    installed[skill.identity] = {
      name: skill.name,
      marketplace: skill.marketplace,
      repository: skill.repository,
      registry: skill.registry,
      version: metadata.version,
      digest: metadata.digest,
      installDirectory,
      installedAt: new Date(await $.clock.now()).toISOString(),
    }
    await $.store.set(STORE_KEY, installed)
    return `Installed ${skill.identity} v${metadata.version} (${metadata.digest}). Run /reload-skills if it is not available immediately.`
  } finally {
    $.ui.status(undefined)
  }
}

async function promptInstall($, skill, metadata, intent = 'install') {
  const answer = await $.ui.ask(
    `${intent === 'update' ? 'Apply update' : 'Install'} ${skill.identity} v${metadata.version} from ${skill.registry}?`,
    { header: intent === 'update' ? 'OCI update' : 'OCI install', options: ['Continue', 'Cancel'] },
  )
  if (answer !== 'Continue') return `${skill.identity}: ${intent} cancelled.`
  return performInstall($, skill, metadata, intent)
}

async function installByIdentity($, requestedIdentity) {
  const { catalogs, errors } = await registeredCatalogs($)
  const skill = flattenCatalogs(catalogs).find((entry) => entry.identity === requestedIdentity)
  if (!skill) {
    const suffix = errors.length ? ` Catalog errors: ${errors.join('; ')}` : ''
    return `No OCI skill named ${requestedIdentity} is available.${suffix}`
  }
  const metadata = await inspectSkill($, skill)
  const installed = await readInstalled($)
  const intent = installed[skill.identity] ? 'update' : 'install'
  return promptInstall($, skill, metadata, intent)
}

async function selectUpdates($, updates) {
  const selected = []
  for (let offset = 0; offset < updates.length; offset += 3) {
    const page = updates.slice(offset, offset + 3)
    const hasMore = offset + page.length < updates.length
    const labels = page.map((_, index) => `Update ${offset + index + 1}`)
    labels.push(hasMore ? 'More…' : 'Dismiss')
    const details = page.map((item, index) =>
      `${labels[index]}: ${item.identity}, v${item.installed.version} → v${item.metadata.version}`,
    )
    const answer = await $.ui.ask(
      `${updates.length} update${updates.length === 1 ? '' : 's'} are available.\n${details.join('\n')}\nSelect skills to update.`,
      { header: 'OCI updates', options: labels, multiSelect: true },
    )
    const choices = answer.split(',').map((item) => item.trim()).filter(Boolean)
    if (choices.includes('Dismiss')) return { selected: [], dismissed: true }
    selected.push(...page.filter((_, index) => choices.includes(`Update ${offset + index + 1}`)))
    if (!choices.includes('More…')) break
  }
  return { selected, dismissed: selected.length === 0 }
}

async function reviewUpdates($) {
  if (await alertsDismissed($)) return 'OCI update alerts were dismissed for this session.'
  const { updates, errors } = await checkInstalledUpdates($)
  const warning = errors.length ? ` Check warnings: ${errors.join('; ')}` : ''
  if (updates.length === 0) {
    return `No installed OCI skill updates are available.${warning}`
  }

  $.ui.toast(`${updates.length} OCI skill update${updates.length === 1 ? '' : 's'} available.`, { timeoutMs: 10000 })
  const choice = await selectUpdates($, updates)
  if (choice.dismissed) {
    await dismissAlerts($)
    return `Dismissed ${updates.length} OCI skill update${updates.length === 1 ? '' : 's'} for this session.${warning}`
  }

  const answer = await $.ui.ask(
    `Apply ${choice.selected.length} selected OCI skill update${choice.selected.length === 1 ? '' : 's'}?`,
    { header: 'Confirm updates', options: ['Apply selected', 'Not now'] },
  )
  if (answer !== 'Apply selected') {
    await dismissAlerts($)
    return 'OCI skill updates postponed for this session.'
  }

  const results = []
  for (const update of choice.selected) {
    try {
      results.push(await performInstall($, update, update.metadata, 'update'))
    } catch (error) {
      results.push(`Update failed for ${update.identity}: ${errorText(error)}. The prior installation remains active.`)
    }
  }
  return `${results.join('\n')}${warning}`
}

async function addMarketplace($, source) {
  if (typeof source !== 'string' || source.trim() === '' || /[\x00-\x1f\x7f]/.test(source)) {
    return 'Provide a non-empty marketplace source.'
  }
  const call = await $.tool.call({
    tool: 'Bash',
    command: `claude plugin marketplace add --scope user ${shellQuote(source)}`,
    description: 'Add a Claude plugin marketplace at user scope',
  })
  if (call.deny) return `Marketplace registration was not approved: ${call.deny}`
  if (call.isError) return `Marketplace registration failed: ${call.text || 'Claude reported an error'}`
  const registrations = await registeredMarketplaces($)
  return `${call.text || 'Marketplace added.'}\n\n${await listMarketplaces($, registrations)}`
}

async function dispatch($, args) {
  if (!args) return usage()
  const [action, ...rest] = args.split(/\s+/)
  const value = rest.join(' ').trim()
  if (action === 'list' && !value) return listMarketplaces($)
  if (action === 'browse' && !value) return browse($)
  if (action === 'installed' && !value) return showInstalled($)
  if (action === 'updates' && !value) return reviewUpdates($)
  if (action === 'install' && value) return installByIdentity($, value)
  if (action === 'add' && value) return addMarketplace($, value)
  return `Unknown or incomplete command.\n\n${usage()}`
}

export function register(on) {
  on('session.start', async ($, event, next) => {
    await $.command.register({
      name: COMMAND_NAME,
      description: 'List and add Claude marketplaces, with OCI skill management for OCI-enabled marketplaces',
      argumentHint: '[list|add <source>|browse|install <skill@marketplace>|updates|installed]',
    })
    const result = await next(event)
    void announceUpdates($)
    return result
  })

  on('command.run', { command: COMMAND_NAME }, ($, event) =>
    dispatch($, event.args.trim())
      .then((text) => ({ text }))
      .catch((error) => ({ text: `OCI Marketplace error: ${errorText(error)}` })),
  )
}
