---
who: Codex
when: 2026-10-16T08:59:26Z
overall_result: passed_after_project_scope_fix
fix_commit: 8f0e472
---

# OCI demo plugin execution log

## Initial run before the fix

The v1 plugin was published and installed through Claude at project scope. The skill returned `OCI demo plugin version 0.1.0`, but `/marketplace-manager installed` reported no marketplace plugins. The native list showed `oci-demo-plugin@claude-oci-demo-marketplace` at project scope. The run stopped before v2 publication, as required by the failed check.

- macOS 26.7.1; Claude Code 2.1.301; ORAS 1.3.4+Homebrew; Git 2.50.1; Python 3.11.9.
- Initial v1 digest: `sha256:41baab315f02e5f36dad8596231d79bb46b9bfef48353680db50a3d75898d78e`.
- The manager's `scope == "user"` filter caused the mismatch.

## Rerun after the fix

**✅ Passed.** Commit `8f0e472` was pushed to `main` before this run. The manager now recognizes native project-scope installations for the active project and carries their scope into update and recovery commands.

### Validate and publish

- Tool versions: macOS 26.7.1; Claude Code 2.1.301; ORAS 1.3.4+Homebrew; Git 2.50.1; Python 3.11.9.
- `claude plugin validate --strict` passed for v1 and v2.
- Published v1 to `quay.io/dmartino/claude-oci-demo:oci-demo-plugin-draft`; manifest version `0.1.0`, artifact type `application/vnd.dmartino.claude.plugin.v1`, directory layer `application/vnd.oci.image.layer.v1.tar+gzip`; digest `sha256:e39be852068725c5553dca8c310e8e4d8df29f45ee8808f0201ecb1fbb0e7750`.
- Published v2 to the same tag while Claude was open; manifest version `0.2.0`; digest `sha256:4c82deec269aca076edd06861c8026b66adf5dc658fd68146c1f79e0767f28ea`.

### Register, install, and verify v1

- Installed `marketplace-manager@claude-oci-marketplace` into a fresh profile at project scope, then added the demo branch through `/marketplace-manager add` and approved its download confirmation and permission prompt.
- `claude plugin marketplace list --json` showed `claude-oci-demo-marketplace` and the standard-only `claude-oci-marketplace` bootstrap. `/plugin` showed the demo marketplace with one plugin.
- Installed `oci-demo-plugin@claude-oci-demo-marketplace` with `claude plugin install ... --scope project`. `claude plugin list --json` reported version `0.1.0`, scope `project`, the active project path, and `projectEnabled: true`.
- `/marketplace-manager installed` reported the project-scoped plugin at v0.1.0 with digest `sha256:e39be852068725c5553dca8c310e8e4d8df29f45ee8808f0201ecb1fbb0e7750`.
- After restarting Claude, `/oci-demo-plugin:demo` returned `OCI demo plugin version 0.1.0`.
- Set `marketplace-manager.poll_interval_minutes` to `1` with Claude's `plugin configure --values-stdin` command and restarted to apply it.

### Verify manager installation and update

- Uninstalled the project-scope plugin. `/marketplace-manager install oci-demo-plugin@claude-oci-demo-marketplace` displayed its confirmation and Claude permission prompt, then installed it through the manager's native install path.
- Restarted Claude and verified the skill again returned `OCI demo plugin version 0.1.0`.
- Published v2 while that Claude session remained open. The one-minute polling window produced the update notice; `/marketplace-manager updates` showed `v0.1.0 → v0.2.0` and the v2 digest. Selected the plugin, approved the update and permission prompt, and the manager reported a successful v2 update.
- After restarting Claude, `/oci-demo-plugin:demo` returned `OCI demo plugin version 0.2.0`.
- The native list and manager helper both reported v0.2.0 and digest `sha256:4c82deec269aca076edd06861c8026b66adf5dc658fd68146c1f79e0767f28ea`.

### Cleanup

- Removed the demo marketplace, manager plugin, and bootstrap marketplace from the isolated profile. Final `claude plugin list --json` returned `[]`.
- Deleted the temporary Claude profile and project directory. The prepared demo folder was not modified.
