---
who: Codex
when: 2026-10-16T08:59:26Z
overall_result: passed_after_project_scope_fix
fix_commit: 8f0e472
---

# OCI demo plugin execution log

**Environment:** macOS 26.7.1 · Claude Code 2.1.301 · ORAS 1.3.4+Homebrew · Git 2.50.1 · Python 3.11.9. Rerun used a fresh Claude profile and project.

## ❌ Initial run

```text
$ claude plugin install oci-demo-plugin@claude-oci-demo-marketplace --scope project
$ claude
> /oci-demo-plugin:demo
OCI demo plugin version 0.1.0
> /marketplace-manager installed
No marketplace plugins are installed.
```

`claude plugin list --json` showed the project-scope install. The manager's `scope == "user"` filter missed it, so v2 was not published. Initial v1 digest: `sha256:41baab315f02e5f36dad8596231d79bb46b9bfef48353680db50a3d75898d78e`.

## ✅ Rerun after `8f0e472`

### Publish v1

From the v1 plugin root:

```text
$ claude plugin validate --strict .
$ oras push quay.io/dmartino/claude-oci-demo:oci-demo-plugin-draft \
    --artifact-type application/vnd.dmartino.claude.plugin.v1 \
    --annotation org.opencontainers.image.title=oci-demo-plugin \
    --annotation org.opencontainers.image.version=0.1.0 .
```

✅ Validation and publish passed. Digest: `sha256:e39be852068725c5553dca8c310e8e4d8df29f45ee8808f0201ecb1fbb0e7750`.

### Register and install v1

```text
$ claude plugin marketplace add https://github.com/dmartinol/claude-oci-marketplace-poc.git --scope project
$ claude plugin install marketplace-manager@claude-oci-marketplace --scope project
$ claude
> /marketplace-manager add https://github.com/dmartinol/claude-oci-marketplace-poc.git#oci-demo-marketplace
> /marketplace-manager list
```

✅ Approved the download and permission prompts. `/plugin` showed the demo marketplace with one plugin; the standard-only bootstrap marketplace was listed too.

```text
$ claude plugin install oci-demo-plugin@claude-oci-demo-marketplace --scope project
$ claude plugin list --json
# observed entry: v0.1.0 · scope=project · active project · enabled
$ claude
> /marketplace-manager installed
# observed entry: v0.1.0 · sha256:e39be852068725c5553dca8c310e8e4d8df29f45ee8808f0201ecb1fbb0e7750
[restart Claude]
$ claude
> /oci-demo-plugin:demo
OCI demo plugin version 0.1.0
```

✅ Project-scope install recognized.

```text
$ claude plugin uninstall oci-demo-plugin@claude-oci-demo-marketplace --scope project
$ claude
> /marketplace-manager install oci-demo-plugin@claude-oci-demo-marketplace
[approve permission prompt; restart Claude]
$ claude
> /oci-demo-plugin:demo
OCI demo plugin version 0.1.0
> /config
# marketplace-manager.poll_interval_minutes = 1
```

✅ Manager install path passed; polling interval set to one minute.

### Detect and apply v2

With Claude still open, from the v2 plugin root:

```text
$ claude plugin validate --strict .
$ oras push quay.io/dmartino/claude-oci-demo:oci-demo-plugin-draft \
    --artifact-type application/vnd.dmartino.claude.plugin.v1 \
    --annotation org.opencontainers.image.title=oci-demo-plugin \
    --annotation org.opencontainers.image.version=0.2.0 .
```

✅ Validation and publish passed. Digest: `sha256:4c82deec269aca076edd06861c8026b66adf5dc658fd68146c1f79e0767f28ea`.

*Illustration of the observed Claude notification; exact wording was not captured.*

```text
╭─ Claude Code ─────────────────────────────────────╮
│ Plugin update available                           │
│ oci-demo-plugin  v0.1.0 → v0.2.0                  │
│ Run /marketplace-manager updates to review it.    │
╰──────────────────────────────────────────────────╯
```

```text
> /marketplace-manager updates
# available: v0.1.0 → v0.2.0 · sha256:4c82deec269aca076edd06861c8026b66adf5dc658fd68146c1f79e0767f28ea
[select plugin; approve update and permission prompt; restart Claude]
$ claude
> /oci-demo-plugin:demo
OCI demo plugin version 0.2.0
```

✅ The native list and manager showed v0.2.0 with the v2 digest.

### Cleanup

```text
$ claude plugin marketplace remove claude-oci-demo-marketplace --scope project
$ claude plugin uninstall marketplace-manager@claude-oci-marketplace --scope project
$ claude plugin marketplace remove claude-oci-marketplace --scope project
$ claude plugin list --json
[]
```

✅ Removed the demo marketplace, manager, and bootstrap marketplace, then deleted the temporary profile and project. The prepared demo folder was unchanged.
