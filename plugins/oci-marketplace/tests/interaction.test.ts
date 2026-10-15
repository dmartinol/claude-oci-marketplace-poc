import { expect, test } from 'claude-code/testing'

const oldDigest = `sha256:${'a'.repeat(64)}`
const newDigest = `sha256:${'b'.repeat(64)}`
const inspectOutput = (digest: string) =>
  `Skill:        quay.io/example/guide\nVersion:      1.2.0\nDigest:       ${digest}\nLayers:       1\n`

test('registers the generic marketplace manager command and shows its actions', async ($, on) => {
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
  const answer = await $.command.run({ command: 'marketplace-manager', args: '' })

  expect(registeredCommand.name).toBe('marketplace-manager')
  expect(registeredCommand.argumentHint).toBe('[list|add <source>|install <plugin@marketplace>|updates|installed]')
  expect(answer.text).toContain('/marketplace-manager list')
  expect(answer.text).toContain('/marketplace-manager updates')
})

test('lists every registered marketplace with its source and capability', async ($, on) => {
  const registrations = [
    {
      name: 'standard-marketplace', source: 'github', repo: 'example/standard',
      installLocation: '/tmp/standard-marketplace',
    },
    {
      name: 'oci-marketplace', source: 'git', url: 'https://example.invalid/oci.git',
      installLocation: '/tmp/oci-marketplace',
    },
  ]
  const invocations: string[][] = []
  on('process.run', (_, event) => {
    invocations.push(event.argv)
    return { value: { exitCode: 0, stdout: JSON.stringify(registrations), stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('fs.exists', (_, event) => ({ value: event.path === '/tmp/oci-marketplace/.claude-plugin/marketplace.json' }))
  on('fs.read', (_, event) => ({ value: JSON.stringify({ plugins: [{
    name: 'demo', description: 'OCI demo', source: 'quay.io/example/demo:1.0.0',
  }] }) }))

  const answer = await $.command.run({ command: 'marketplace-manager', args: 'list' })

  expect(answer.text).toContain('- standard-marketplace | github: example/standard | standard-only')
  expect(answer.text).toContain('- oci-marketplace | git: https://example.invalid/oci.git | OCI-enabled')
  expect(answer.text).toContain('demo@oci-marketplace | quay.io/example/demo:1.0.0 | OCI demo')
  expect(answer.text).toContain('Use /plugin to discover and install standard marketplace plugins.')
  expect(answer.text).toContain('/marketplace-manager install <plugin@marketplace>')
  expect(invocations).toEqual([['claude', 'plugin', 'marketplace', 'list', '--json']])
})

test('dismisses update alerts for the rest of the session', async ($, on) => {
  const installed = {
    'guide@marketplace-one': {
      name: 'guide', marketplace: 'marketplace-one', source: 'quay.io/example/guide:1.2.0',
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
  let currentSessionId = 'test-session'
  on('session.id', () => ({ value: currentSessionId }))
  on('process.run', (_, event) => {
    if (event.argv[0] === 'claude') {
      const output = JSON.stringify([{ name: 'marketplace-one', installLocation: '/tmp/marketplace-one' }])
      return { value: { exitCode: 0, stdout: output, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
    }
    return { value: { exitCode: 0, stdout: inspectOutput(newDigest), stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('fs.exists', () => ({ value: true }))
  on('fs.read', () => ({ value: JSON.stringify({ plugins: [{ name: 'guide', description: 'A demo guide', source: 'quay.io/example/guide:1.2.0' }] }) }))
  let dialogs = 0
  on('tool.call', { tool: 'AskUserQuestion' }, (_, event) => {
    dialogs += 1
    return { result: { questions: event.questions, answers: { [event.questions[0].question]: 'Dismiss' } } }
  })

  const first = await $.command.run({ command: 'marketplace-manager', args: 'updates' })
  const second = await $.command.run({ command: 'marketplace-manager', args: 'updates' })
  currentSessionId = 'next-session'
  const nextSession = await $.command.run({ command: 'marketplace-manager', args: 'updates' })

  expect(first.text).toContain('Dismissed 1 OCI skill update')
  expect(second.text).toContain('dismissed for this session')
  expect(nextSession.text).toContain('Dismissed 1 OCI skill update')
  expect(dialogs).toBe(2)
})

test('manual update check reports unchanged skills without an alert', async ($, on) => {
  const installed = {
    'guide@marketplace-one': {
      name: 'guide', marketplace: 'marketplace-one', source: 'quay.io/example/guide:1.2.0',
      registry: 'quay.io', version: '1.2.0', digest: newDigest,
      installDirectory: 'guide@marketplace-one', installedAt: '2026-10-14T00:00:00.000Z',
    },
  }
  let toasts = 0
  const commands: string[][] = []
  on('store.get', (_, event) => ({ value: event.key === 'installedSkills' ? installed : undefined }))
  on('session.id', () => ({ value: 'test-session' }))
  on('process.run', (_, event) => {
    commands.push(event.argv)
    return event.argv[0] === 'claude'
      ? ({ value: { exitCode: 0, stdout: JSON.stringify([{ name: 'marketplace-one', installLocation: '/tmp/marketplace-one' }]), stderr: '', isStdoutTruncated: false, isStderrTruncated: false } })
      : ({ value: { exitCode: 0, stdout: inspectOutput(newDigest), stderr: '', isStdoutTruncated: false, isStderrTruncated: false } })
  })
  on('fs.exists', () => ({ value: true }))
  on('fs.read', () => ({ value: JSON.stringify({ plugins: [{ name: 'guide', description: 'A demo guide', source: 'quay.io/example/guide:1.2.0' }] }) }))
  on('ui.toast', () => {
    toasts += 1
    return { value: undefined }
  })

  const answer = await $.command.run({ command: 'marketplace-manager', args: 'updates' })

  expect(answer.text).toBe('No installed OCI skill updates are available.')
  expect(toasts).toBe(0)
  expect(commands).toEqual([
    ['claude', 'plugin', 'marketplace', 'list', '--json'],
    ['skillctl', 'inspect', 'quay.io/example/guide:1.2.0'],
  ])
})

test('isolates update digests by marketplace and reports one OCI source metadata error', async ($, on) => {
  const installed = Object.fromEntries(['one', 'two', 'three'].map((suffix, index) => {
    const marketplace = `marketplace-${suffix}`
    return [`guide@${marketplace}`, {
      name: 'guide', marketplace, source: `quay.io/example/guide-${suffix}:1.2.0`,
      registry: 'quay.io', version: '1.1.0', digest: oldDigest,
      installDirectory: `guide@${marketplace}`, installedAt: '2026-10-14T00:00:00.000Z',
    }]
  }))
  const registrations = ['one', 'two', 'three'].map((suffix) => ({ name: `marketplace-${suffix}`, installLocation: `/tmp/marketplace-${suffix}` }))
  const prompts: string[] = []
  const eventOrder: string[] = []
  let warningsSaved = ''
  const invocations: string[][] = []
  on('store.get', (_, event) => ({ value: event.key === 'installedSkills' ? installed : undefined }))
  on('store.set', (_, event) => {
    if (event.key === 'dismissedSessionId') warningsSaved = String(event.value)
    return { value: undefined }
  })
  on('session.id', () => ({ value: 'test-session' }))
  on('process.run', (_, event) => {
    invocations.push(event.argv)
    if (event.argv[0] === 'claude') {
      return { value: { exitCode: 0, stdout: JSON.stringify(registrations), stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
    }
    if (event.argv[2].includes('guide-three')) {
      return { value: { exitCode: 8, stdout: '', stderr: 'registry unavailable', isStdoutTruncated: false, isStderrTruncated: false } }
    }
    const digest = event.argv[2].includes('guide-one') ? newDigest : oldDigest
    return { value: { exitCode: 0, stdout: inspectOutput(digest), stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('fs.exists', () => ({ value: true }))
  on('fs.read', (_, event) => {
    const suffix = event.path.includes('marketplace-one') ? 'one' : event.path.includes('marketplace-two') ? 'two' : 'three'
    return { value: JSON.stringify({ plugins: [{ name: 'guide', description: 'A demo guide', source: `quay.io/example/guide-${suffix}:1.2.0` }] }) }
  })
  on('ui.toast', () => {
    eventOrder.push('toast')
    return { value: undefined }
  })
  on('tool.call', { tool: 'AskUserQuestion' }, (_, event) => {
    prompts.push(event.questions[0].question)
    eventOrder.push('selection')
    return { result: { questions: event.questions, answers: { [event.questions[0].question]: 'Dismiss' } } }
  })

  const answer = await $.command.run({ command: 'marketplace-manager', args: 'updates' })

  expect(answer.text).toContain('Dismissed 1 OCI skill update for this session.')
  expect(answer.text).toContain('Check warnings: guide@marketplace-three: registry unavailable')
  expect(prompts).toHaveLength(1)
  expect(prompts[0]).toContain('guide@marketplace-one')
  expect(prompts[0]).not.toContain('guide@marketplace-two')
  expect(prompts[0]).not.toContain('guide@marketplace-three')
  expect(eventOrder).toEqual(['toast', 'selection'])
  expect(warningsSaved).toBe('test-session')
  expect(invocations.filter((argv) => argv[0] === 'skillctl').every((argv) => argv[1] === 'inspect')).toBe(true)
})

test('summarizes multiple updates, retains a subset, and postpones without pulling', async ($, on) => {
  const installed = {
    'guide@marketplace-one': {
      name: 'guide', marketplace: 'marketplace-one', source: 'quay.io/example/guide:1.2.0',
      registry: 'quay.io', version: '1.1.0', digest: oldDigest,
      installDirectory: 'guide@marketplace-one', installedAt: '2026-10-14T00:00:00.000Z',
    },
    'reference@marketplace-two': {
      name: 'reference', marketplace: 'marketplace-two', source: 'quay.io/example/reference:1.2.0',
      registry: 'quay.io', version: '1.1.0', digest: oldDigest,
      installDirectory: 'reference@marketplace-two', installedAt: '2026-10-14T00:00:00.000Z',
    },
  }
  const registrations = [
    { name: 'marketplace-one', installLocation: '/tmp/marketplace-one' },
    { name: 'marketplace-two', installLocation: '/tmp/marketplace-two' },
  ]
  const store: Record<string, unknown> = { installedSkills: installed }
  const prompts: string[] = []
  const eventOrder: string[] = []
  const calls: string[][] = []
  let bashCalls = 0
  on('store.get', (_, event) => ({ value: store[event.key] }))
  on('store.set', (_, event) => {
    store[event.key] = event.value
    return { value: undefined }
  })
  on('session.id', () => ({ value: 'test-session' }))
  on('process.run', (_, event) => {
    calls.push(event.argv)
    if (event.argv[0] === 'claude') {
      return { value: { exitCode: 0, stdout: JSON.stringify(registrations), stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
    }
    return { value: { exitCode: 0, stdout: inspectOutput(newDigest), stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('fs.exists', () => ({ value: true }))
  on('fs.read', (_, event) => {
    const marketplace = event.path.includes('marketplace-one') ? 'marketplace-one' : 'marketplace-two'
    const name = marketplace === 'marketplace-one' ? 'guide' : 'reference'
    return { value: JSON.stringify({ plugins: [{ name, description: 'A demo skill', source: `quay.io/example/${name}:1.2.0` }] }) }
  })
  on('ui.toast', () => {
    eventOrder.push('toast')
    return { value: undefined }
  })
  on('tool.call', { tool: 'AskUserQuestion' }, (_, event) => {
    const question = event.questions[0].question
    prompts.push(question)
    eventOrder.push(prompts.length === 1 ? 'summary selection' : 'apply confirmation')
    const answer = prompts.length === 1 ? 'Update 1' : 'Not now'
    return { result: { questions: event.questions, answers: { [question]: answer } } }
  })
  on('tool.call', { tool: 'Bash' }, () => {
    bashCalls += 1
    return { result: { text: 'unexpected install' } }
  })

  const answer = await $.command.run({ command: 'marketplace-manager', args: 'updates' })

  expect(answer.text).toContain('OCI skill updates postponed for this session.')
  expect(prompts).toHaveLength(2)
  expect(prompts[0]).toContain('guide@marketplace-one')
  expect(prompts[0]).toContain('reference@marketplace-two')
  expect(prompts[1]).toContain('Apply 1 selected OCI skill update')
  expect(eventOrder).toEqual(['toast', 'summary selection', 'apply confirmation'])
  expect(bashCalls).toBe(0)
  expect(calls.filter((argv) => argv[0] === 'skillctl').every((argv) => argv[1] === 'inspect')).toBe(true)
  expect(store.installedSkills).toEqual(installed)
  expect(store.dismissedSessionId).toBe('test-session')
})

test('applies only selected updates and persists only their new metadata', async ($, on) => {
  const installed = {
    'guide@marketplace-one': {
      name: 'guide', marketplace: 'marketplace-one', source: 'quay.io/example/guide:1.2.0',
      registry: 'quay.io', version: '1.1.0', digest: oldDigest,
      installDirectory: 'guide@marketplace-one', installedAt: '2026-10-14T00:00:00.000Z',
    },
    'reference@marketplace-two': {
      name: 'reference', marketplace: 'marketplace-two', source: 'quay.io/example/reference:1.2.0',
      registry: 'quay.io', version: '1.1.0', digest: oldDigest,
      installDirectory: 'reference@marketplace-two', installedAt: '2026-10-14T00:00:00.000Z',
    },
  }
  const state: Record<string, unknown> = { installedSkills: installed }
  const registrations = [
    { name: 'marketplace-one', installLocation: '/tmp/marketplace-one' },
    { name: 'marketplace-two', installLocation: '/tmp/marketplace-two' },
  ]
  const askPrompts: string[] = []
  const bashCommands: string[] = []
  let askCount = 0
  on('store.get', (_, event) => ({ value: state[event.key] }))
  on('store.set', (_, event) => {
    state[event.key] = event.value
    return { value: undefined }
  })
  on('session.id', () => ({ value: 'test-session' }))
  on('process.run', (_, event) => {
    if (event.argv[0] === 'claude') {
      return { value: { exitCode: 0, stdout: JSON.stringify(registrations), stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
    }
    return { value: { exitCode: 0, stdout: `Version: 0.2.0\nDigest: ${newDigest}\n`, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('fs.exists', () => ({ value: true }))
  on('fs.read', (_, event) => {
    const marketplace = event.path.includes('marketplace-one') ? 'marketplace-one' : 'marketplace-two'
    const name = marketplace === 'marketplace-one' ? 'guide' : 'reference'
    return { value: JSON.stringify({ plugins: [{ name, description: 'A demo skill', source: `quay.io/example/${name}:1.2.0` }] }) }
  })
  let envReadCount = 0
  on('env.get', () => ({ value: envReadCount++ % 2 === 0 ? '/tmp/demo-home' : undefined }))
  on('clock.now', () => ({ value: 1791936000000 }))
  on('ui.status', () => ({ value: undefined }))
  on('tool.call', { tool: 'AskUserQuestion' }, (_, event) => {
    askCount += 1
    const question = event.questions[0].question
    askPrompts.push(question)
    const answer = askCount === 1 ? 'Update 1' : 'Apply selected'
    return { result: { questions: event.questions, answers: { [question]: answer } } }
  })
  on('tool.call', { tool: 'Bash' }, (_, event) => {
    bashCommands.push(event.command)
    return { result: { text: 'Activated selected skill' } }
  })

  const answer = await $.command.run({ command: 'marketplace-manager', args: 'updates' })
  const updatedState = state.installedSkills as Record<string, Record<string, unknown>>

  expect(answer.text).toContain('Installed guide@marketplace-one v0.2.0')
  expect(bashCommands).toHaveLength(1)
  expect(bashCommands[0]).toContain("'quay.io/example/guide:1.2.0'")
  expect(bashCommands[0]).not.toContain('reference')
  expect(askPrompts[0]).toContain('reference@marketplace-two')
  expect(askPrompts[1]).toContain('Apply 1 selected OCI skill update')
  expect(updatedState['guide@marketplace-one'].version).toBe('0.2.0')
  expect(updatedState['guide@marketplace-one'].digest).toBe(newDigest)
  expect(updatedState['reference@marketplace-two']).toEqual(installed['reference@marketplace-two'])
})

test('failed selected update preserves v1 installed state', async ($, on) => {
  const record = {
    name: 'guide', marketplace: 'marketplace-one', source: 'quay.io/example/guide:1.2.0',
    registry: 'quay.io', version: '1.1.0', digest: oldDigest,
    installDirectory: 'guide@marketplace-one', installedAt: '2026-10-14T00:00:00.000Z',
  }
  const state: Record<string, unknown> = { installedSkills: { 'guide@marketplace-one': record } }
  let askCount = 0
  let writes = 0
  on('store.get', (_, event) => ({ value: state[event.key] }))
  on('store.set', (_, event) => {
    writes += 1
    state[event.key] = event.value
    return { value: undefined }
  })
  on('session.id', () => ({ value: 'test-session' }))
  on('process.run', (_, event) => event.argv[0] === 'claude'
    ? ({ value: { exitCode: 0, stdout: JSON.stringify([{ name: 'marketplace-one', installLocation: '/tmp/marketplace-one' }]), stderr: '', isStdoutTruncated: false, isStderrTruncated: false } })
    : ({ value: { exitCode: 0, stdout: `Version: 0.2.0\nDigest: ${newDigest}\n`, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }))
  on('fs.exists', () => ({ value: true }))
  on('fs.read', () => ({ value: JSON.stringify({ plugins: [{ name: 'guide', description: 'A demo guide', source: 'quay.io/example/guide:1.2.0' }] }) }))
  let envReadCount = 0
  on('env.get', () => ({ value: envReadCount++ % 2 === 0 ? '/tmp/demo-home' : undefined }))
  on('clock.now', () => ({ value: 1791936000000 }))
  on('ui.status', () => ({ value: undefined }))
  on('tool.call', { tool: 'AskUserQuestion' }, (_, event) => {
    askCount += 1
    const question = event.questions[0].question
    const answer = askCount === 1 ? 'Update 1' : 'Apply selected'
    return { result: { questions: event.questions, answers: { [question]: answer } } }
  })
  on('tool.call', { tool: 'Bash' }, () => ({
    result: { text: 'simulated activation failure', isError: true },
    isError: true,
    text: 'simulated activation failure',
  }))

  const answer = await $.command.run({ command: 'marketplace-manager', args: 'updates' })

  expect(answer.text).toContain('Update failed for guide@marketplace-one')
  expect(answer.text).toContain('simulated activation failure')
  expect(writes).toBe(0)
  expect(state.installedSkills).toEqual({ 'guide@marketplace-one': record })
})

test('persists a successful install and shows it in a later installed view', async ($, on) => {
  const digest = newDigest
  const registration = [{ name: 'marketplace-one', installLocation: '/tmp/marketplace-one' }]
  const manifest = JSON.stringify({ plugins: [{ name: 'guide', description: 'A demo guide', source: 'quay.io/example/guide:1.2.0' }] })
  const store: Record<string, unknown> = {}
  const actionOrder: string[] = []
  let bashCommand = ''
  let envReadCount = 0
  on('process.run', (_, event) => event.argv[0] === 'claude'
    ? ({ value: { exitCode: 0, stdout: JSON.stringify(registration), stderr: '', isStdoutTruncated: false, isStderrTruncated: false } })
    : ({ value: { exitCode: 0, stdout: inspectOutput(digest), stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }))
  on('fs.exists', () => ({ value: true }))
  on('fs.read', () => ({ value: manifest }))
  on('store.get', (_, event) => ({ value: store[event.key] }))
  on('store.set', (_, event) => {
    store[event.key] = event.value
    return { value: undefined }
  })
  on('env.get', () => ({ value: envReadCount++ % 2 === 0 ? '/tmp/demo-home' : '/tmp/demo-config' }))
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

  const installed = await $.command.run({ command: 'marketplace-manager', args: 'install guide@marketplace-one' })
  const record = (store.installedSkills as Record<string, Record<string, unknown>>)?.['guide@marketplace-one']
  expect(installed.text).toContain('Installed guide@marketplace-one v1.2.0')
  expect(actionOrder).toEqual(['native confirmation', 'permission-checked installer'])
  expect(bashCommand).toContain("'quay.io/example/guide:1.2.0'")
  expect(bashCommand).toContain(`'${digest}'`)
  expect(bashCommand).toContain("'/tmp/demo-config/skills/.oci-marketplace-stage-")
  expect(bashCommand).toContain("'/tmp/demo-config/skills/guide@marketplace-one'")
  expect(record).toEqual({
    name: 'guide',
    marketplace: 'marketplace-one',
    source: 'quay.io/example/guide:1.2.0',
    registry: 'quay.io',
    version: '1.2.0',
    digest,
    installDirectory: 'guide@marketplace-one',
    installedAt: new Date(1791936000000).toISOString(),
  })

  const laterView = await $.command.run({ command: 'marketplace-manager', args: 'installed' })
  expect(laterView.text).toContain('guide@marketplace-one: v1.2.0 | quay.io |')
  expect(laterView.text).toContain(digest)
})

test('cancelled and failed installs do not change installed state', async ($, on) => {
  const digest = newDigest
  const record = {
    name: 'guide', marketplace: 'marketplace-one', source: 'quay.io/example/guide:1.2.0',
    registry: 'quay.io', version: '1.1.0', digest: oldDigest,
    installDirectory: 'guide@marketplace-one', installedAt: '2026-10-14T00:00:00.000Z',
  }
  const store: Record<string, unknown> = { installedSkills: { 'guide@marketplace-one': record } }
  const registration = [{ name: 'marketplace-one', installLocation: '/tmp/marketplace-one' }]
  const manifest = JSON.stringify({ plugins: [{ name: 'guide', description: 'A demo guide', source: 'quay.io/example/guide:1.2.0' }] })
  let questionCount = 0
  let writes = 0
  let bashCalls = 0
  const skillctlCalls: string[][] = []
  let envReadCount = 0
  on('process.run', (_, event) => {
    if (event.argv[0] === 'claude') {
      return { value: { exitCode: 0, stdout: JSON.stringify(registration), stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
    }
    skillctlCalls.push(event.argv)
    return { value: { exitCode: 0, stdout: inspectOutput(digest), stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('fs.exists', () => ({ value: true }))
  on('fs.read', () => ({ value: manifest }))
  on('store.get', (_, event) => ({ value: store[event.key] }))
  on('store.set', (_, event) => {
    writes += 1
    store[event.key] = event.value
    return { value: undefined }
  })
  on('env.get', () => ({ value: envReadCount++ % 2 === 0 ? '/tmp/demo-home' : undefined }))
  on('clock.now', () => ({ value: 1791936000000 }))
  on('ui.status', () => ({ value: undefined }))
  on('tool.call', { tool: 'AskUserQuestion' }, (_, event) => {
    questionCount += 1
    const answer = questionCount === 1 ? 'Cancel' : 'Continue'
    return { result: { questions: event.questions, answers: { [event.questions[0].question]: answer } } }
  })
  on('tool.call', { tool: 'Bash' }, () => {
    bashCalls += 1
    return {
      result: { text: 'permission denied', isError: true },
      isError: true,
      text: 'permission denied',
    }
  })

  const cancelled = await $.command.run({ command: 'marketplace-manager', args: 'install guide@marketplace-one' })
  const failed = await $.command.run({ command: 'marketplace-manager', args: 'install guide@marketplace-one' })
  expect(cancelled.text).toContain('update cancelled')
  expect(failed.text).toContain('permission denied')
  expect(bashCalls).toBe(1)
  expect(skillctlCalls).toEqual([
    ['skillctl', 'inspect', 'quay.io/example/guide:1.2.0'],
    ['skillctl', 'inspect', 'quay.io/example/guide:1.2.0'],
  ])
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
  on('fs.read', () => ({ value: JSON.stringify({ plugins: [{ name: 'guide', description: 'A demo guide', source: 'quay.io/example/guide:1.2.0' }] }) }))

  const processFailure = await $.command.run({ command: 'marketplace-manager', args: 'install guide@marketplace-one' })
  failureMode = 'metadata'
  const metadataFailure = await $.command.run({ command: 'marketplace-manager', args: 'install guide@marketplace-one' })

  expect(processFailure.text).toContain('registry refused request')
  expect(metadataFailure.text).toContain('did not include a version and sha256 digest')
  expect(invocations.filter((argv) => argv[0] === 'skillctl')).toEqual([
    ['skillctl', 'inspect', 'quay.io/example/guide:1.2.0'],
    ['skillctl', 'inspect', 'quay.io/example/guide:1.2.0'],
  ])
})

test('adds standard-only and OCI marketplaces at user scope, then refreshes discovery', async ($, on) => {
  let registrations: Array<Record<string, string>> = []
  const commands: string[] = []
  on('tool.call', { tool: 'Bash' }, (_, event) => {
    commands.push(event.command)
    if (event.command.includes('standard.git')) {
      registrations = [{
        name: 'standard-only', source: 'github', repo: 'example/standard',
        installLocation: '/tmp/standard-only',
      }]
      return { result: { text: 'Successfully added marketplace: standard-only' } }
    }
    registrations.push({
      name: 'oci-enabled', source: 'git', url: 'https://example.invalid/oci.git',
      installLocation: '/tmp/oci-enabled',
    })
    return { result: { text: 'Successfully added marketplace: oci-enabled' } }
  })
  on('process.run', (_, event) => ({
    value: {
      exitCode: 0,
      stdout: JSON.stringify(registrations),
      stderr: '',
      isStdoutTruncated: false,
      isStderrTruncated: false,
    },
  }))
  on('fs.exists', (_, event) => ({ value: event.path === '/tmp/oci-enabled/.claude-plugin/marketplace.json' }))
  on('fs.read', () => ({ value: JSON.stringify({ plugins: [{ name: 'guide', description: 'A demo guide', source: 'quay.io/example/guide:1.2.0' }] }) }))

  const standard = await $.command.run({ command: 'marketplace-manager', args: 'add https://example.invalid/standard.git' })
  const oci = await $.command.run({ command: 'marketplace-manager', args: 'add ssh://git@example.invalid/oci.git' })

  expect(standard.text).toContain('- standard-only | github: example/standard | standard-only')
  expect(standard.text).toContain('/plugin to discover and install standard marketplace plugins')
  expect(oci.text).toContain('- standard-only | github: example/standard | standard-only')
  expect(oci.text).toContain('- oci-enabled | git: https://example.invalid/oci.git | OCI-enabled')
  expect(commands).toEqual([
    "claude plugin marketplace add --scope user 'https://example.invalid/standard.git'",
    "claude plugin marketplace add --scope user 'ssh://git@example.invalid/oci.git'",
  ])
})

test('returns Claude marketplace-add errors without refreshing discovery', async ($, on) => {
  let listCalls = 0
  on('tool.call', { tool: 'Bash' }, () => ({
    result: { isError: true, text: 'invalid marketplace source' },
    isError: true,
    text: 'invalid marketplace source',
  }))
  on('process.run', () => {
    listCalls += 1
    return { value: { exitCode: 0, stdout: '[]', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })

  const answer = await $.command.run({ command: 'marketplace-manager', args: 'add https://example.invalid/bad.git' })

  expect(answer.text).toContain('Marketplace registration failed: invalid marketplace source')
  expect(listCalls).toBe(0)
})
