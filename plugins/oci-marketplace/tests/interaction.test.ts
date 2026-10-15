import { expect, test } from 'claude-code/testing'

const digest = `sha256:${'b'.repeat(64)}`
const plugin = {
  identity: 'demo@demo-marketplace', name: 'demo', marketplace: 'demo-marketplace',
  description: 'Demo plugin', source: 'quay.io/example/demo:latest', registry: 'quay.io',
  version: '0.1.0', digest: `sha256:${'a'.repeat(64)}`, installed: true,
}
const listing = { marketplaces: [{ name: 'demo-marketplace', source: 'https://example.invalid/demo.git', classification: 'OCI-enabled' }], plugins: [plugin], errors: [] }
const updates = { updates: [{ ...plugin, installedVersion: '0.1.0', metadata: { version: '0.2.0', digest } }], errors: [] }
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
