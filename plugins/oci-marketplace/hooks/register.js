export function register(on) {
  on('session.start', async ($, event, next) => {
    await $.command.register({
      name: 'oci-marketplace',
      description: 'Open the OCI skill marketplace manager',
      argumentHint: '[verify-update-flow]',
    })

    return next(event)
  })

  on('command.run', { command: 'oci-marketplace' }, async ($, event) => {
    if (event.args.trim() !== 'verify-update-flow') {
      return {
        text: 'OCI Marketplace mod loaded. Run /oci-marketplace verify-update-flow to exercise the feasibility flow.',
      }
    }

    $.ui.toast('A newer OCI skill digest is available.', { timeoutMs: 10000 })

    const answer = await $.ui.ask('Apply the selected OCI skill update?', {
      header: 'OCI update',
      options: ['Apply update', 'Not now'],
    })

    if (answer !== 'Apply update') {
      return { text: 'OCI skill update dismissed for this session.' }
    }

    $.ui.status('Waiting for Claude permission…')

    try {
      await $.tool.call({
        tool: 'Bash',
        command: 'skillctl --version',
        description: 'Verify skillctl before applying updates',
      })

      return {
        text: 'Claude permission granted and skillctl verification completed.',
      }
    } catch (error) {
      return {
        text: `Claude permission was not granted: ${error instanceof Error ? error.message : String(error)}`,
      }
    } finally {
      $.ui.status(undefined)
    }
  })
}
