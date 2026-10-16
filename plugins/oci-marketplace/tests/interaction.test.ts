import { expect, mock, test } from 'claude-code/testing'

const digest = `sha256:${'b'.repeat(64)}`
const plugin = {
  identity: 'demo@demo-marketplace', name: 'demo', marketplace: 'demo-marketplace',
  description: 'Demo plugin', entrySource: './.oci-plugins/demo',
  source: 'quay.io/example/demo:latest', registry: 'quay.io',
  version: '0.1.0', digest: `sha256:${'a'.repeat(64)}`, installed: true, installedScope: 'project', kind: 'oci',
}
const standardPlugin = {
  identity: 'standard-demo@demo-marketplace', name: 'standard-demo', marketplace: 'demo-marketplace',
  description: 'Standard demo plugin', entrySource: './standard-demo', source: './standard-demo',
  version: '1.2.0', registry: '', digest: '', installed: false, installedScope: null, kind: 'standard',
}
const secondStandardPlugin = {
  identity: 'plain@plain-marketplace', name: 'plain', marketplace: 'plain-marketplace',
  description: 'Plain marketplace plugin', entrySource: './plain', source: './plain',
  version: '2.0.0', registry: '', digest: '', installed: false, installedScope: null, kind: 'standard',
}
const listing = {
  marketplaces: [
    { name: 'demo-marketplace', source: 'https://example.invalid/demo.git', classification: 'OCI-enabled' },
    { name: 'plain-marketplace', source: 'https://example.invalid/plain.git', classification: 'standard-only' },
  ],
  plugins: [plugin, standardPlugin, secondStandardPlugin], errors: [],
}
const updates = { updates: [{ ...plugin, installedVersion: '0.1.0', metadata: { version: '0.2.0', digest } }], errors: [] }
const browsePane = {
  plugin: 'marketplace-manager', component: 'Pane', requestId: 'marketplace-manager-browser',
  viewport: { columns: 100, rows: 30 },
  props: { title: 'Marketplace browser', isFocused: true, bodyColumns: 60,
    placement: 'inline', scroll: { offset: 0, bodyRows: 20 }, view: {} },
} as const
const processResult = (data: unknown) => ({ value: { exitCode: 0, stdout: JSON.stringify(data), stderr: '', isStdoutTruncated: false, isStderrTruncated: false } })
const askResult = (event: any, answer: string) => ({ result: { questions: event.questions, answers: { [event.questions[0].question]: answer } } })

test('lists local marketplaces and plugin metadata through only the read-only helper', async ($, on) => {
  const calls: string[][] = []
  let mutations = 0
  on('process.run', (_, event) => { calls.push(event.argv); return processResult(listing) })
  on('tool.call', { tool: 'Bash' }, () => { mutations += 1; return { result: { text: '{}' } } })
  const answer = await $.command.run({ command: 'marketplace-manager', args: 'list' })
  expect(answer.text).toContain('demo-marketplace | https://example.invalid/demo.git | OCI-enabled')
  expect(answer.text).toContain('demo@demo-marketplace | v0.1.0 | quay.io |')
  expect(answer.text).toContain('installed')
  expect(answer.text).toContain('Use /plugin or /marketplace-manager install')
  expect(calls).toHaveLength(1)
  expect(calls[0][0]).toBe('python3')
  expect(calls[0][1]).toContain('/hooks/manager.py')
  expect(calls[0][2]).toBe('list')
  expect(mutations).toBe(0)
})

test('browse opens a local-only pane and shows marketplace and OCI plugin provenance', async ($, on) => {
  const calls: string[][] = []
  let pane: any
  on('process.run', (_, event) => { calls.push(event.argv); return processResult(listing) })
  on('ui.open', (_, event) => { pane = event; return { value: { isPlaced: true } } })

  await $.command.run({ command: 'marketplace-manager', args: 'browse' })
  expect(pane.id).toBe('marketplace-manager-browser')
  expect(pane.title).toBe('Marketplace browser')
  expect(calls).toHaveLength(1)
  expect(calls[0][2]).toBe('list')

  const ui = await $.ui.mount({ ...browsePane, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: 'Registered Claude marketplaces' })).toBeDefined()
  await ui.press({ key: 'marketplace-0' })
  expect(await ui.find({ type: 'Text', text: 'Marketplace: demo-marketplace' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'Registered source: https://example.invalid/demo.git' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'Classification: OCI-enabled' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'Description: Demo plugin' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'Installed scope: project' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'Source: ./.oci-plugins/demo' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'Original OCI reference: quay.io/example/demo:latest' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'Registry: quay.io' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: `Recorded digest: ${plugin.digest}` })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'standard-demo@demo-marketplace' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'Description: Standard demo plugin' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'Version: v1.2.0' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'Installed: Not installed' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'Source: ./standard-demo' })).toBeDefined()

  await ui.press({ key: 'back-to-marketplaces' })
  expect(await ui.find({ type: 'Text', text: 'Registered Claude marketplaces' })).toBeDefined()
  await ui.press({ key: 'marketplace-1' })
  expect(await ui.find({ type: 'Text', text: 'Marketplace: plain-marketplace' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'Classification: standard-only' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'plain@plain-marketplace' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'Description: Plain marketplace plugin' })).toBeDefined()
  await ui.unmount()
})

test('browse handles empty and malformed marketplace data with a text fallback intact', async ($, on) => {
  on('process.run', () => processResult({ marketplaces: [{ name: 42 }], plugins: null, errors: ['broken marketplace entry'] }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  const answer = await $.command.run({ command: 'marketplace-manager', args: 'browse' })
  expect(answer.text).toBe('')
  const ui = await $.ui.mount({ ...browsePane, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: 'No Claude marketplaces are registered.' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'Warning 1: broken marketplace entry' })).toBeDefined()
  await ui.unmount()
})

test('confirms downloads before invoking permission-checked marketplace add', async ($, on) => {
  const order: string[] = []
  let command = ''
  on('tool.call', { tool: 'AskUserQuestion' }, (_, event) => {
    order.push('confirmation')
    expect(event.questions[0].question).toContain('downloads and extracts')
    return askResult(event, 'Continue')
  })
  on('tool.call', { tool: 'Bash' }, (_, event) => {
    order.push('permission'); command = event.command
    return { result: { text: JSON.stringify({ text: 'Added demo marketplace' }) }, text: JSON.stringify({ text: 'Added demo marketplace' }) }
  })
  on('process.run', () => processResult(listing))
  const answer = await $.command.run({ command: 'marketplace-manager', args: 'add https://example.invalid/demo.git' })
  expect(order).toEqual(['confirmation', 'permission'])
  expect(command).toContain("'add' 'https://example.invalid/demo.git'")
  expect(command).toContain('/hooks/manager.py')
  expect(answer.text).toContain('Added demo marketplace')
})

test('cancelled add makes no process or mutation calls', async ($, on) => {
  let calls = 0
  on('tool.call', { tool: 'AskUserQuestion' }, (_, event) => askResult(event, 'Cancel'))
  on('tool.call', { tool: 'Bash' }, () => { calls += 1; return { result: { text: '{}' } } })
  on('process.run', () => { calls += 1; return processResult(listing) })
  const answer = await $.command.run({ command: 'marketplace-manager', args: 'add https://example.invalid/demo.git' })
  expect(answer.text).toContain('cancelled')
  expect(calls).toBe(0)
})

test('installation uses native helper and reports permission denial', async ($, on) => {
  let command = ''
  on('process.run', () => processResult(listing))
  on('tool.call', { tool: 'AskUserQuestion' }, (_, event) => askResult(event, 'Continue'))
  on('tool.call', { tool: 'Bash' }, (_, event) => {
    command = event.command
    return { result: { text: 'permission denied', isError: true }, text: 'permission denied', isError: true }
  })
  const answer = await $.command.run({ command: 'marketplace-manager', args: 'install demo@demo-marketplace' })
  expect(command).toContain("'install' 'demo@demo-marketplace'")
  expect(answer.text).toContain('permission denied')
})

test('installed view recognizes native installed records without a mod-owned installed store', async ($, on) => {
  on('process.run', (_, event) => {
    expect(event.argv[2]).toBe('installed')
    return processResult({ plugins: [plugin], errors: [] })
  })
  const answer = await $.command.run({ command: 'marketplace-manager', args: 'installed' })
  expect(answer.text).toContain('Installed plugins:')
  expect(answer.text).toContain(plugin.digest)
})

test('applies only the selected update with its reviewed digest and version', async ($, on) => {
  const second = { ...updates.updates[0], identity: 'other@demo-marketplace' }
  const commands: string[] = []
  let questions = 0
  on('process.run', (_, event) => {
    expect(event.argv[2]).toBe('updates')
    return processResult({ updates: [...updates.updates, second], errors: [] })
  })
  on('store.set', () => ({ value: undefined }))
  on('tool.call', { tool: 'AskUserQuestion' }, (_, event) => {
    questions += 1
    return askResult(event, questions === 1 ? 'Update 1' : 'Apply selected')
  })
  on('tool.call', { tool: 'Bash' }, (_, event) => {
    commands.push(event.command)
    return { result: { text: JSON.stringify({ text: 'Updated demo; restart Claude.' }) }, text: JSON.stringify({ text: 'Updated demo; restart Claude.' }) }
  })
  const answer = await $.command.run({ command: 'marketplace-manager', args: 'updates' })
  expect(commands).toHaveLength(1)
  expect(commands[0]).toContain(`'update' 'demo@demo-marketplace' '${digest}' '0.2.0'`)
  expect(commands[0]).not.toContain('other@')
  expect(questions).toBe(2)
  expect(answer.text).toContain('restart Claude')
})

test('manual refresh resets session dismissal and can offer the same update again', async ($, on) => {
  const store: Record<string, unknown> = { dismissedSessionId: 'session-one' }
  let prompts = 0
  on('store.get', (_, event) => ({ value: store[event.key] }))
  on('store.set', (_, event) => { store[event.key] = event.value; return { value: undefined } })
  on('session.id', () => ({ value: 'session-one' }))
  on('process.run', () => processResult(updates))
  on('tool.call', { tool: 'AskUserQuestion' }, (_, event) => { prompts += 1; return askResult(event, 'Dismiss') })
  await $.command.run({ command: 'marketplace-manager', args: 'updates' })
  await $.command.run({ command: 'marketplace-manager', args: 'updates' })
  expect(prompts).toBe(2)
  expect(store.dismissedSessionId).toBe('session-one')
})

test('startup respects dismissal while registering the plugin command', async ($, on) => {
  mock.clock(on)
  let reads = 0
  let registered = ''
  on('store.get', () => ({ value: 'session-one' }))
  on('session.id', () => ({ value: 'session-one' }))
  on('process.run', () => { reads += 1; return processResult(updates) })
  on('command.register', (_, event) => { registered = event.name; return { value: { command: event.name } } })
  on('session.start', (_, event) => ({ cwd: event.cwd }))
  await $.session.start({ cwd: '/tmp/manager-test', surface: null, isInteractive: false })
  await $.command.run({ command: 'marketplace-manager', args: '' })
  expect(registered).toBe('marketplace-manager')
  expect(reads).toBe(0)
})

test('failed update reports helper error and does not write installed state', async ($, on) => {
  const writes: string[] = []
  let questions = 0
  on('process.run', () => processResult(updates))
  on('store.set', (_, event) => { writes.push(event.key); return { value: undefined } })
  on('tool.call', { tool: 'AskUserQuestion' }, (_, event) => askResult(event, ++questions === 1 ? 'Update 1' : 'Apply selected'))
  on('tool.call', { tool: 'Bash' }, () => ({ result: { text: 'pull failed; previous plugin retained', isError: true }, text: 'pull failed; previous plugin retained', isError: true }))
  const answer = await $.command.run({ command: 'marketplace-manager', args: 'updates' })
  expect(answer.text).toContain('Update failed for demo@demo-marketplace')
  expect(answer.text).toContain('previous plugin retained')
  expect(writes).toEqual(['dismissedSessionId'])
})

test('startup emits a non-blocking update notice when the session has not dismissed it', async ($, on) => {
  mock.clock(on)
  let resolveNotice: (value: string) => void = () => {}
  const notice = new Promise<string>((resolve) => { resolveNotice = resolve })
  const calls: string[][] = []
  let mutations = 0
  on('store.get', () => ({ value: undefined }))
  on('session.id', () => ({ value: 'fresh-session' }))
  on('process.run', (_, event) => { calls.push(event.argv); return processResult(updates) })
  on('ui.toast', (_, event) => { resolveNotice(event.text); return { value: undefined } })
  on('tool.call', { tool: 'Bash' }, () => { mutations += 1; return { result: { text: '{}' } } })
  on('command.register', (_, event) => ({ value: { command: event.name } }))
  on('session.start', (_, event) => ({ cwd: event.cwd }))
  await $.session.start({ cwd: '/tmp/manager-test', surface: null, isInteractive: false })
  expect(await notice).toContain('1 OCI plugin update available')
  expect(calls).toHaveLength(1)
  expect(calls[0][2]).toBe('updates')
  expect(mutations).toBe(0)
})

test('polls every configured minute and only repeats the notice for a changed digest', async ($, on) => {
  const clock = mock.clock(on)
  const notices: string[] = []
  let checked = 0
  let current = updates
  on('config.list', () => ({ value: [{ key: 'marketplace-manager.poll_interval_minutes', value: '1' }] }))
  on('store.get', () => ({ value: undefined }))
  on('session.id', () => ({ value: 'poll-session' }))
  on('command.register', (_, event) => ({ value: { command: event.name } }))
  on('session.start', (_, event) => ({ cwd: event.cwd }))
  on('process.run', () => { checked += 1; return processResult(current) })
  on('ui.toast', (_, event) => { notices.push(event.text); return { value: undefined } })

  await $.session.start({ cwd: '/tmp/manager-test', surface: null, isInteractive: false })
  await clock.settle()
  expect(checked).toBe(1)
  expect(notices).toHaveLength(1)

  current = { updates: [{ ...updates.updates[0], metadata: { version: '0.3.0', digest: `sha256:${'c'.repeat(64)}` } }], errors: [] }
  await clock.advance(60 * 1000)
  await clock.settle()
  expect(checked).toBe(2)
  expect(notices).toHaveLength(2)

  await clock.advance(60 * 1000)
  await clock.settle()
  expect(checked).toBe(3)
  expect(notices).toHaveLength(2)
})

test('uses the five-minute default interval when configured for normal use', async ($, on) => {
  const clock = mock.clock(on)
  let checked = 0
  on('config.list', () => ({ value: [{ key: 'marketplace-manager.poll_interval_minutes', value: '5' }] }))
  on('store.get', () => ({ value: undefined }))
  on('session.id', () => ({ value: 'five-minute-session' }))
  on('command.register', (_, event) => ({ value: { command: event.name } }))
  on('session.start', (_, event) => ({ cwd: event.cwd }))
  on('process.run', () => { checked += 1; return processResult(updates) })

  await $.session.start({ cwd: '/tmp/manager-test', surface: null, isInteractive: false })
  await clock.settle()
  expect(checked).toBe(1)
  await clock.advance(60 * 1000)
  await clock.settle()
  expect(checked).toBe(1)
  await clock.advance(4 * 60 * 1000)
  await clock.settle()
  expect(checked).toBe(2)
})

test('multi-page update selection preserves marketplace identities and skips unselected plugins', async ($, on) => {
  const pending = ['one', 'two', 'three', 'four', 'five'].map((marketplace, index) => ({
    ...plugin, identity: `demo@${marketplace}`, marketplace,
    installedVersion: '0.1.0', metadata: { version: `0.2.${index}`, digest: `sha256:${String(index + 1).repeat(64)}` },
  }))
  const prompts: string[] = []
  const commands: string[] = []
  on('process.run', () => processResult({ updates: pending, errors: [] }))
  on('store.set', () => ({ value: undefined }))
  on('tool.call', { tool: 'AskUserQuestion' }, (_, event) => {
    prompts.push(event.questions[0].question)
    const answers = ['Update 2, More…', 'Update 5', 'Apply selected']
    return askResult(event, answers[prompts.length - 1])
  })
  on('tool.call', { tool: 'Bash' }, (_, event) => {
    commands.push(event.command)
    const text = JSON.stringify({ text: 'Selected plugin updated.' })
    return { result: { text }, text }
  })
  const answer = await $.command.run({ command: 'marketplace-manager', args: 'updates' })
  expect(prompts).toHaveLength(3)
  expect(prompts[0]).toContain('demo@one')
  expect(prompts[0]).toContain('demo@three')
  expect(prompts[1]).toContain('demo@four')
  expect(prompts[1]).toContain('demo@five')
  expect(prompts[2]).toContain('Apply 2 selected OCI plugin updates')
  expect(commands).toHaveLength(2)
  expect(commands[0]).toContain(`'update' 'demo@two' '${pending[1].metadata.digest}' '0.2.1'`)
  expect(commands[1]).toContain(`'update' 'demo@five' '${pending[4].metadata.digest}' '0.2.4'`)
  expect(commands.join('\n')).not.toContain("'demo@one'")
  expect(commands.join('\n')).not.toContain("'demo@three'")
  expect(commands.join('\n')).not.toContain("'demo@four'")
  expect(answer.text).toContain('Selected plugin updated.')
})
