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
  on('process.run', (_, event) => {
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
