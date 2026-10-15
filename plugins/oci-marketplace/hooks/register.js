import {
  artifactsFromRegistrations,
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
const MARKETPLACE_FILE = '.claude-plugin/marketplace.json'
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

async function registeredArtifacts($, registrations = undefined) {
  registrations ??= await registeredMarketplaces($)
  return artifactsFromRegistrations(registrations, async (registration) => {
    const marketplacePath = `${registration.installLocation}/${MARKETPLACE_FILE}`
    if (!(await $.fs.exists(marketplacePath))) return undefined
    return $.fs.read(marketplacePath)
  })
}

function formatMarketplaces(marketplaces, artifacts = [], errors = []) {
  if (marketplaces.length === 0) return 'No Claude marketplaces are registered.'
  const lines = [
    'Registered Claude marketplaces:',
    ...marketplaces.map((marketplace) => `- ${marketplace.name} | ${marketplace.source} | ${marketplace.classification}`),
    '',
    ...artifacts.map((artifact) => `  - ${artifact.identity} | ${artifact.source} | ${artifact.description}`),
    '',
    'Use /plugin to discover and install standard marketplace plugins.',
    'Install a listed OCI entry with /marketplace-manager install <plugin@marketplace>.',
  ]
  if (errors.length) lines.push('', ...errors.map((error) => `Marketplace discovery warning: ${error}`))
  return lines.join('\n')
}

async function listMarketplaces($, registrations = undefined) {
  registrations ??= await registeredMarketplaces($)
  const { artifacts, errors } = await registeredArtifacts($, registrations)
  const marketplaces = await marketplacesFromRegistrations(registrations, async (registration) =>
    artifacts.some((artifact) => artifact.marketplace === registration.name),
  )
  return formatMarketplaces(marketplaces, artifacts, errors)
}

async function inspectSkill($, skill) {
  const output = await runProcess((argv, options) => $.process.run(argv, options), ['skillctl', 'inspect', skill.source], 60000)
  return parseInspection(output)
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

async function checkInstalledUpdates($) {
  const { artifacts, errors: discoveryErrors } = await registeredArtifacts($)
  const installed = await readInstalled($)
  const matching = artifacts.filter((skill) => installed[skill.identity])
  const checked = await inspectedEntries($, matching)
  const inspectErrors = checked.flatMap(({ skill, error }) => error ? [`${skill.identity}: ${error}`] : [])
  const updates = checked.flatMap(({ skill, metadata, error }) => {
    const prior = installed[skill.identity]
    if (!metadata || metadata.digest === prior.digest) return []
    return [{ ...skill, metadata, installed: prior, inspectError: error }]
  })
  return { updates, errors: [...discoveryErrors, ...inspectErrors], installed, artifacts }
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

async function showInstalled($) {
  const installed = await readInstalled($)
  const entries = Object.values(installed)
  if (entries.length === 0) return 'No OCI skills are installed yet. Use /plugin to discover marketplace entries.'
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
    shellQuote(skill.source),
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
      source: skill.source,
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
  const { artifacts, errors } = await registeredArtifacts($)
  const skill = artifacts.find((entry) => entry.identity === requestedIdentity)
  if (!skill) {
    const suffix = errors.length ? ` Marketplace errors: ${errors.join('; ')}` : ''
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
      argumentHint: '[list|add <source>|install <plugin@marketplace>|updates|installed]',
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
