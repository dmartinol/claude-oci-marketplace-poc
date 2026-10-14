import { expect, test } from 'claude-code/testing'

const oldDigest = `sha256:${'a'.repeat(64)}`
const newDigest = `sha256:${'b'.repeat(64)}`
const inspectOutput = (digest: string) =>
  `Skill:        quay.io/example/guide\nVersion:      1.2.0\nDigest:       ${digest}\nLayers:       1\n`

test('registers the namespaced command and shows the available actions', async ($, on) => {
  let registeredCommand: Record<string, unknown> = {}
  on('command.register', (_, event) => {
    registeredCommand = event
    return { value: { command: event.name } }
  })
  on('process.run', () => ({ value: { exitCode: 0, stdout: '[]', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }))
  on('store.get', () => ({ value: undefined }))
  on('session.id', () => ({ value: 'test-session' }))
  on('session.start', (_, event) => ({ cwd: event.cwd }))

  await $.session.start({ cwd: '/tmp/oci-marketplace-test', surface: null, isInteractive: false })
  const answer = await $.command.run({ command: 'oci-marketplace', args: '' })

  expect(registeredCommand.name).toBe('oci-marketplace')
  expect(registeredCommand.argumentHint).toBe('[browse|add <git-url>|install <skill@marketplace>|updates|installed]')
  expect(answer.text).toContain('/oci-marketplace browse')
  expect(answer.text).toContain('/oci-marketplace updates')
})

test('browses multiple OCI catalogs and ignores standard-only marketplaces', async ($, on) => {
  const catalogs = [
    { name: 'marketplace-one', installLocation: '/tmp/marketplace-one' },
    { name: 'standard-only', installLocation: '/tmp/standard-only' },
    { name: 'marketplace-two', installLocation: '/tmp/marketplace-two' },
  ]
  const document = JSON.stringify({ skills: [{ name: 'guide', description: 'A demo guide', repository: 'quay.io/example/guide:1.2.0' }] })
  const invocations: string[][] = []
  on('process.run', (_, event) => {
    invocations.push(event.argv)
    if (event.argv[0] === 'claude') {
      return { value: { exitCode: 0, stdout: JSON.stringify(catalogs), stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
    }
    return { value: { exitCode: 0, stdout: inspectOutput(newDigest), stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('store.get', () => ({ value: undefined }))
  on('fs.exists', (_, event) => ({ value: event.path !== '/tmp/standard-only/oci-catalog.json' }))
  on('fs.read', () => ({ value: document }))
  on('tool.call', { tool: 'AskUserQuestion' }, (_, event) => ({
    result: { questions: event.questions, answers: { [event.questions[0].question]: 'Done' } },
  }))

  const answer = await $.command.run({ command: 'oci-marketplace', args: 'browse' })

  expect(answer.text).toContain('guide@marketplace-one')
  expect(answer.text).toContain('guide@marketplace-two')
  expect(answer.text).not.toContain('guide@standard-only')
  expect(answer.text).toContain(newDigest)
  expect(invocations).toEqual([
    ['claude', 'plugin', 'marketplace', 'list', '--json'],
    ['skillctl', 'inspect', 'quay.io/example/guide:1.2.0'],
    ['skillctl', 'inspect', 'quay.io/example/guide:1.2.0'],
  ])
})

test('dismisses update alerts for the rest of the session', async ($, on) => {
  const installed = {
    'guide@marketplace-one': {
      name: 'guide', marketplace: 'marketplace-one', repository: 'quay.io/example/guide:1.2.0',
      registry: 'quay.io', version: '1.1.0', digest: oldDigest, installDirectory: 'guide@marketplace-one',
    },
  }
  let dismissedSessionId: string | undefined
  on('store.get', (_, event) => ({
    value: event.key === 'installedSkills' ? installed : event.key === 'dismissedSessionId' ? dismissedSessionId : undefined,
  }))
  on('store.set', (_, event) => {
    if (event.key === 'dismissedSessionId') dismissedSessionId = String(event.value)
    return { value: undefined }
  })
  on('session.id', () => ({ value: 'test-session' }))
  on('process.run', (_, event) => {
    if (event.argv[0] === 'claude') {
      const output = JSON.stringify([{ name: 'marketplace-one', installLocation: '/tmp/marketplace-one' }])
      return { value: { exitCode: 0, stdout: output, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
    }
    return { value: { exitCode: 0, stdout: inspectOutput(newDigest), stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('fs.exists', () => ({ value: true }))
  on('fs.read', () => ({ value: JSON.stringify({ skills: [{ name: 'guide', description: 'A demo guide', repository: 'quay.io/example/guide:1.2.0' }] }) }))
  let dialogs = 0
  on('tool.call', { tool: 'AskUserQuestion' }, (_, event) => {
    dialogs += 1
    return { result: { questions: event.questions, answers: { [event.questions[0].question]: 'Dismiss' } } }
  })

  const first = await $.command.run({ command: 'oci-marketplace', args: 'updates' })
  const second = await $.command.run({ command: 'oci-marketplace', args: 'updates' })

  expect(first.text).toContain('Dismissed 1 OCI skill update')
  expect(second.text).toContain('dismissed for this session')
  expect(dialogs).toBe(1)
})

test('persists a successful install and shows it in a later installed view', async ($, on) => {
  const digest = newDigest
  const registration = [{ name: 'marketplace-one', installLocation: '/tmp/marketplace-one' }]
  const catalog = JSON.stringify({ skills: [{ name: 'guide', description: 'A demo guide', repository: 'quay.io/example/guide:1.2.0' }] })
  const store: Record<string, unknown> = {}
  const actionOrder: string[] = []
  let bashCommand = ''
  on('process.run', (_, event) => event.argv[0] === 'claude'
    ? ({ value: { exitCode: 0, stdout: JSON.stringify(registration), stderr: '', isStdoutTruncated: false, isStderrTruncated: false } })
    : ({ value: { exitCode: 0, stdout: inspectOutput(digest), stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }))
  on('fs.exists', () => ({ value: true }))
  on('fs.read', () => ({ value: catalog }))
  on('store.get', (_, event) => ({ value: store[event.key] }))
  on('store.set', (_, event) => {
    store[event.key] = event.value
    return { value: undefined }
  })
  on('env.get', () => ({ value: '/tmp/demo-home' }))
  on('clock.now', () => ({ value: 1791936000000 }))
  on('tool.call', { tool: 'AskUserQuestion' }, (_, event) => {
    actionOrder.push('native confirmation')
    return { result: { questions: event.questions, answers: { [event.questions[0].question]: 'Continue' } } }
  })
  on('tool.call', { tool: 'Bash' }, (_, event) => {
    actionOrder.push('permission-checked installer')
    bashCommand = event.command
    return { result: { text: 'Activated skill at /tmp/demo-home/.claude/skills/guide@marketplace-one' } }
  })

  const installed = await $.command.run({ command: 'oci-marketplace', args: 'install guide@marketplace-one' })
  const record = (store.installedSkills as Record<string, Record<string, unknown>>)?.['guide@marketplace-one']
  expect(installed.text).toContain('Installed guide@marketplace-one v1.2.0')
  expect(actionOrder).toEqual(['native confirmation', 'permission-checked installer'])
  expect(bashCommand).toContain("'quay.io/example/guide:1.2.0'")
  expect(bashCommand).toContain(`'${digest}'`)
  expect(record).toEqual({
    name: 'guide',
    marketplace: 'marketplace-one',
    repository: 'quay.io/example/guide:1.2.0',
    registry: 'quay.io',
    version: '1.2.0',
    digest,
    installDirectory: 'guide@marketplace-one',
    installedAt: new Date(1791936000000).toISOString(),
  })

  const laterView = await $.command.run({ command: 'oci-marketplace', args: 'installed' })
  expect(laterView.text).toContain('guide@marketplace-one: v1.2.0 | quay.io |')
  expect(laterView.text).toContain(digest)
})

test('cancelled and failed installs do not change installed state', async ($, on) => {
  const digest = newDigest
  const record = {
    name: 'guide', marketplace: 'marketplace-one', repository: 'quay.io/example/guide:1.2.0',
    registry: 'quay.io', version: '1.1.0', digest: oldDigest,
    installDirectory: 'guide@marketplace-one', installedAt: '2026-10-14T00:00:00.000Z',
  }
  const store: Record<string, unknown> = { installedSkills: { 'guide@marketplace-one': record } }
  const registration = [{ name: 'marketplace-one', installLocation: '/tmp/marketplace-one' }]
  const catalog = JSON.stringify({ skills: [{ name: 'guide', description: 'A demo guide', repository: 'quay.io/example/guide:1.2.0' }] })
  let questionCount = 0
  let writes = 0
  on('process.run', (_, event) => event.argv[0] === 'claude'
    ? ({ value: { exitCode: 0, stdout: JSON.stringify(registration), stderr: '', isStdoutTruncated: false, isStderrTruncated: false } })
    : ({ value: { exitCode: 0, stdout: inspectOutput(digest), stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }))
  on('fs.exists', () => ({ value: true }))
  on('fs.read', () => ({ value: catalog }))
  on('store.get', (_, event) => ({ value: store[event.key] }))
  on('store.set', (_, event) => {
    writes += 1
    store[event.key] = event.value
    return { value: undefined }
  })
  on('env.get', () => ({ value: '/tmp/demo-home' }))
  on('clock.now', () => ({ value: 1791936000000 }))
  on('ui.status', () => ({ value: undefined }))
  on('tool.call', { tool: 'AskUserQuestion' }, (_, event) => {
    questionCount += 1
    const answer = questionCount === 1 ? 'Cancel' : 'Continue'
    return { result: { questions: event.questions, answers: { [event.questions[0].question]: answer } } }
  })
  on('tool.call', { tool: 'Bash' }, () => ({
    result: { text: 'permission denied', isError: true },
    isError: true,
    text: 'permission denied',
  }))

  const cancelled = await $.command.run({ command: 'oci-marketplace', args: 'install guide@marketplace-one' })
  const failed = await $.command.run({ command: 'oci-marketplace', args: 'install guide@marketplace-one' })
  expect(cancelled.text).toContain('update cancelled')
  expect(failed.text).toContain('permission denied')
  expect(writes).toBe(0)
  expect(store.installedSkills).toEqual({ 'guide@marketplace-one': record })
})

test('reports skillctl process and metadata failures clearly', async ($, on) => {
  let failureMode = 'process'
  const invocations: string[][] = []
  on('process.run', (_, event) => {
    invocations.push(event.argv)
    if (event.argv[0] === 'claude') {
      return { value: { exitCode: 0, stdout: JSON.stringify([{ name: 'marketplace-one', installLocation: '/tmp/marketplace-one' }]), stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
    }
    if (failureMode === 'process') {
      return { value: { exitCode: 17, stdout: '', stderr: 'registry refused request', isStdoutTruncated: false, isStderrTruncated: false } }
    }
    return { value: { exitCode: 0, stdout: 'Version: 1.2.0\n', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('fs.exists', () => ({ value: true }))
  on('fs.read', () => ({ value: JSON.stringify({ skills: [{ name: 'guide', description: 'A demo guide', repository: 'quay.io/example/guide:1.2.0' }] }) }))

  const processFailure = await $.command.run({ command: 'oci-marketplace', args: 'install guide@marketplace-one' })
  failureMode = 'metadata'
  const metadataFailure = await $.command.run({ command: 'oci-marketplace', args: 'install guide@marketplace-one' })

  expect(processFailure.text).toContain('registry refused request')
  expect(metadataFailure.text).toContain('did not include a version and sha256 digest')
  expect(invocations.filter((argv) => argv[0] === 'skillctl')).toEqual([
    ['skillctl', 'inspect', 'quay.io/example/guide:1.2.0'],
    ['skillctl', 'inspect', 'quay.io/example/guide:1.2.0'],
  ])
})
