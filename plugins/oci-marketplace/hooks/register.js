const DISMISS_KEY = 'dismissedSessionId'
const COMMAND_NAME = 'marketplace-manager'

function errorText(error) {
  return error instanceof Error ? error.message : String(error)
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\"'\"'")}'`
}

function helperPath($) {
  return `${$.plugin.root}/hooks/manager.py`
}

async function read($, action) {
  const result = await $.process.run(['python3', helperPath($), action], { timeoutMs: 60000 })
  if (result.exitCode !== 0) throw new Error(result.stderr.trim() || result.stdout.trim() || `Helper exited ${result.exitCode}`)
  if (result.isStdoutTruncated) throw new Error('Manager helper output was truncated')
  return JSON.parse(result.stdout)
}

function warnings(errors = []) {
  return errors.length ? `\n${errors.map((error) => `Warning: ${error}`).join('\n')}` : ''
}

function pluginLine(plugin) {
  return `- ${plugin.identity} | v${plugin.version || 'unknown'} | ${plugin.registry || plugin.source || 'native'} | ${plugin.digest || 'native source'} | ${plugin.installed ? 'installed' : 'not installed'}${plugin.description ? ` | ${plugin.description}` : ''}`
}

function usage() {
  return [
    'Claude Marketplace Manager', '', 'Commands:',
    '  /marketplace-manager list',
    '  /marketplace-manager add <git-url>',
    '  /marketplace-manager install <plugin@marketplace>',
    '  /marketplace-manager updates',
    '  /marketplace-manager installed', '',
    'Registered marketplaces and their plugins are also available through /plugin.',
  ].join('\n')
}

async function listMarketplaces($) {
  const { marketplaces = [], plugins = [], errors = [] } = await read($, 'list')
  const lines = marketplaces.length
    ? ['Registered Claude marketplaces:', ...marketplaces.map((item) => `- ${item.name} | ${item.source} | ${item.classification}`)]
    : ['No Claude marketplaces are registered.']
  if (plugins.length) lines.push('', 'Plugins:', ...plugins.map(pluginLine))
  lines.push('', 'Use /plugin or /marketplace-manager install <plugin@marketplace> to install.')
  return lines.join('\n') + warnings(errors)
}

async function showInstalled($) {
  const { plugins = [], errors = [] } = await read($, 'installed')
  return (plugins.length ? ['Installed plugins:', ...plugins.map(pluginLine)].join('\n') : 'No marketplace plugins are installed.') + warnings(errors)
}

async function perform($, action, args, description) {
  $.ui.status(`Waiting for permission: ${description}…`)
  try {
    const call = await $.tool.call({
      tool: 'Bash',
      command: ['python3', helperPath($), action, ...args].map(shellQuote).join(' '),
      description,
    })
    if (call.deny) throw new Error(`Permission denied: ${call.deny}`)
    if (call.isError) throw new Error(call.text || 'Claude reported an error')
    // Bash wraps stdout as text; the deterministic helper always emits JSON.
    const result = JSON.parse(call.text)
    if (result.error) throw new Error(result.error)
    return result.text || 'Operation completed. Restart Claude to activate plugin changes.'
  } finally {
    $.ui.status(undefined)
  }
}

async function addMarketplace($, source) {
  if (/[\x00-\x1f\x7f]/.test(source)) return 'Provide a valid marketplace Git URL.'
  const answer = await $.ui.ask(
    `Add marketplace ${source}? This retrieves its Git content and downloads and extracts any OCI plugins with ORAS before registering it in Claude.`,
    { header: 'Add marketplace', options: ['Continue', 'Cancel'] },
  )
  if (answer !== 'Continue') return 'Marketplace add cancelled.'
  const result = await perform($, 'add', [source], 'Add marketplace and extract OCI plugins')
  return `${result}\n\n${await listMarketplaces($)}`
}

async function installByIdentity($, identity) {
  const { plugins = [], errors = [] } = await read($, 'list')
  const plugin = plugins.find((item) => item.identity === identity)
  if (!plugin) return `No plugin named ${identity} is available.${warnings(errors)}`
  const answer = await $.ui.ask(
    `Install ${identity} v${plugin.version || 'unknown'} from ${plugin.registry || plugin.source || 'its native marketplace'}?${plugin.digest ? `\nDigest: ${plugin.digest}` : ''}`,
    { header: 'Install plugin', options: ['Continue', 'Cancel'] },
  )
  if (answer !== 'Continue') return `${identity}: install cancelled.`
  return perform($, 'install', [identity], `Install plugin ${identity}`)
}

async function alertsDismissed($) {
  return (await $.store.get(DISMISS_KEY)) === await $.session.id()
}

async function dismissAlerts($) {
  await $.store.set(DISMISS_KEY, await $.session.id())
}

async function announceUpdates($) {
  try {
    if (await alertsDismissed($)) return
    const { updates = [], errors = [] } = await read($, 'updates')
    for (const error of errors) $.ui.log(`Marketplace startup check: ${error}`, { to: 'debug' })
    if (updates.length) $.ui.toast(`${updates.length} OCI plugin update${updates.length === 1 ? '' : 's'} available. Run /marketplace-manager updates to review.`, { timeoutMs: 10000 })
  } catch (error) {
    $.ui.log(`Marketplace startup check failed: ${errorText(error)}`, { to: 'debug' })
  }
}

async function selectUpdates($, updates) {
  const selected = []
  for (let offset = 0; offset < updates.length; offset += 3) {
    const page = updates.slice(offset, offset + 3)
    const labels = page.map((_, index) => `Update ${offset + index + 1}`)
    labels.push(offset + page.length < updates.length ? 'More…' : 'Dismiss')
    const details = page.map((item, index) => `${labels[index]}: ${item.identity}, v${item.installedVersion || item.version} → v${item.metadata.version} | ${item.registry}\nDigest: ${item.metadata.digest}`)
    const answer = await $.ui.ask(
      `${updates.length} plugin update${updates.length === 1 ? '' : 's'} available.\n${details.join('\n')}\nSelect plugins to update.`,
      { header: 'OCI updates', options: labels, multiSelect: true },
    )
    const choices = answer.split(',').map((item) => item.trim())
    if (choices.includes('Dismiss')) return []
    selected.push(...page.filter((_, index) => choices.includes(`Update ${offset + index + 1}`)))
    if (!choices.includes('More…')) break
  }
  return selected
}

async function reviewUpdates($) {
  // An explicit manual refresh may show an update dismissed earlier this session.
  await $.store.set(DISMISS_KEY, null)
  const { updates = [], errors = [] } = await read($, 'updates')
  if (!updates.length) return `No OCI plugin updates are available.${warnings(errors)}`
  $.ui.toast(`${updates.length} OCI plugin update${updates.length === 1 ? '' : 's'} available.`, { timeoutMs: 10000 })
  const selected = await selectUpdates($, updates)
  if (!selected.length) {
    await dismissAlerts($)
    return `Dismissed OCI plugin updates for this session.${warnings(errors)}`
  }
  const answer = await $.ui.ask(`Apply ${selected.length} selected OCI plugin update${selected.length === 1 ? '' : 's'}?`, { header: 'Confirm updates', options: ['Apply selected', 'Not now'] })
  if (answer !== 'Apply selected') {
    await dismissAlerts($)
    return 'OCI plugin updates postponed for this session.'
  }
  const results = []
  for (const plugin of selected) {
    try {
      results.push(await perform($, 'update', [plugin.identity, plugin.metadata.digest, plugin.metadata.version], `Update plugin ${plugin.identity}`))
    } catch (error) {
      results.push(`Update failed for ${plugin.identity}: ${errorText(error)}`)
    }
  }
  return results.join('\n') + warnings(errors)
}

async function dispatch($, args) {
  if (!args) return usage()
  const [action, ...rest] = args.split(/\s+/)
  const value = rest.join(' ')
  if (action === 'list' && !value) return listMarketplaces($)
  if (action === 'installed' && !value) return showInstalled($)
  if (action === 'updates' && !value) return reviewUpdates($)
  if (action === 'install' && value) return installByIdentity($, value)
  if (action === 'add' && value) return addMarketplace($, value)
  return `Unknown or incomplete command.\n\n${usage()}`
}

export function register(on) {
  on('session.start', async ($, event, next) => {
    await $.command.register({ name: COMMAND_NAME, description: 'List and add Claude marketplaces, install plugins, and review OCI plugin updates', argumentHint: '[list|add <git-url>|install <plugin@marketplace>|updates|installed]' })
    const result = await next(event)
    void announceUpdates($)
    return result
  })
  on('command.run', { command: COMMAND_NAME }, ($, event) => dispatch($, event.args.trim())
    .then((text) => ({ text }))
    .catch((error) => ({ text: `Marketplace manager error: ${errorText(error)}` })))
}
