import { expect, test } from 'claude-code/testing'

test('registers the deterministic manager command', async ($, on) => {
  let registeredCommand = {}

  on('command.register', ($, event) => {
    registeredCommand = event
    return { value: { command: event.name } }
  })
  on('session.start', ($, event) => ({ cwd: event.cwd }))

  await $.session.start({
    cwd: '/tmp/oci-marketplace-test',
    surface: null,
    isInteractive: false,
  })

  const answer = await $.command.run({ command: 'oci-marketplace', args: '' })

  expect(registeredCommand).toEqual({
    name: 'oci-marketplace',
    description: 'Open the OCI skill marketplace manager',
    argumentHint: '[verify-update-flow]',
  })
  expect(answer.text).toBe(
    'OCI Marketplace mod loaded. Run /oci-marketplace verify-update-flow to exercise the feasibility flow.',
  )
})

test('shows the update indicator and honors dismissal', async ($, on) => {
  let toastText = ''

  on('ui.toast', async (_, event, next) => {
    toastText = event.text
    return next(event)
  })

  on('tool.call', { tool: 'AskUserQuestion' }, ($, event) => ({
    result: {
      questions: event.questions,
      answers: {
        'Apply the selected OCI skill update?': 'Not now',
      },
    },
  }))

  const answer = await $.command.run({
    command: 'oci-marketplace',
    args: 'verify-update-flow',
  })

  expect(toastText).toBe('A newer OCI skill digest is available.')
  expect(answer.text).toBe('OCI skill update dismissed for this session.')
})

test('transitions from native confirmation to the permissioned tool call', async ($, on) => {
  let bashCommand = ''

  on('tool.call', { tool: 'AskUserQuestion' }, ($, event) => ({
    result: {
      questions: event.questions,
      answers: {
        'Apply the selected OCI skill update?': 'Apply update',
      },
    },
  }))

  on('tool.call', { tool: 'Bash' }, ($, event) => {
    bashCommand = event.command
    return {
      result: {
        stdout: 'skillctl version 0.4.0\n',
        stderr: '',
        interrupted: false,
      },
    }
  })

  const answer = await $.command.run({
    command: 'oci-marketplace',
    args: 'verify-update-flow',
  })

  expect(bashCommand).toBe('skillctl --version')
  expect(answer.text).toBe('Claude permission granted and skillctl verification completed.')
})
