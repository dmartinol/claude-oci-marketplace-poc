# Feasibility Report

This report records evidence gathered during the P0 feasibility spike defined in [plan.md](plan.md). Credential values, tokens, usernames, and registry namespaces are intentionally excluded.

## Environment

**Task:** T001 — Inventory the demo environment  
**Result:** Pass  
**Observed:** 2026-10-13 (Europe/Rome)

### Platform and tools

| Component | Executable or source | Observed version |
| --- | --- | --- |
| macOS | `sw_vers` | macOS 26.7.1, build 25G241 |
| Architecture | `uname -m` | arm64 |
| Darwin kernel | `uname -r` | 25.6.0 |
| Claude Code | `/Users/dmartino/.local/bin/claude` | 2.1.296 |
| `skillctl` | `/opt/homebrew/bin/skillctl` | 0.4.0 |
| Git | `/usr/bin/git` | 2.50.1 (Apple Git-155) |
| Docker CLI | resolved from `PATH` | 29.0.2, build 8108357bcb |
| Podman CLI | resolved from `PATH` | 6.0.0 |

Commands exercised:

```text
$ sw_vers
ProductName:            macOS
ProductVersion:         26.7.1
BuildVersion:           25G241

$ uname -m
arm64

$ uname -r
25.6.0

$ command -v claude
/Users/dmartino/.local/bin/claude

$ claude --version
2.1.296 (Claude Code)

$ command -v skillctl
/opt/homebrew/bin/skillctl

$ skillctl --version
skillctl version 0.4.0

$ command -v git
/usr/bin/git

$ git --version
git version 2.50.1 (Apple Git-155)
```

The requirements originally named `skillctl version`, but the installed CLI reports that as an unknown command. Its help output documents `-v, --version`, and both supported flags report version 0.4.0. Subsequent tasks must use `skillctl --version`.

### Registry configuration

Local registry configuration is available for the required Quay host:

| Credential store | Quay entry | Credential material | File mode |
| --- | --- | --- | --- |
| `~/.docker/config.json` | Present | Present | `0600` |
| `~/.config/containers/auth.json` | Present | Present | `0600` |

The verification parsed only configuration structure and boolean presence. It did not print, decode, copy, or persist credential values, usernames, registry namespaces, or tokens. No matching `QUAY`, `REGISTRY`, `OCI`, or `SKILL` environment-variable names were present.

T001 confirms that local registry configuration is available. It does not prove that a remote authentication or artifact operation succeeds; T005 owns that live verification using the supplied registry coordinates.

### T001 acceptance

- [x] macOS and executable locations are recorded.
- [x] `claude --version` and the supported `skillctl --version` output are recorded.
- [x] Supplied registry configuration is confirmed available without exposing credentials.

### Conclusion

T001 passes. The demo machine satisfies the initial macOS and tool-presence prerequisites, and protected Quay credential entries are locally available. T002 is ready to begin. No product requirement or decision change is required from this task.

## Standard marketplace

**Task:** T002 — Prove standard marketplace integration

**Result:** Pass

**Observed:** 2026-10-13 (Europe/Rome)

### Validated repository shape

The repository now contains the minimum standard Claude marketplace structure:

```text
.claude-plugin/marketplace.json
plugins/oci-marketplace/.claude-plugin/plugin.json
```

The marketplace is named `claude-oci-marketplace` and contains one plugin entry, `oci-marketplace`, whose manifest name matches the entry name. The plugin is versioned as 0.1.0. It intentionally has no skills, hooks, or mod code yet; deterministic command and UI behavior belong to T003.

Both validation targets passed in strict mode:

```text
$ claude plugin validate --strict ./plugins/oci-marketplace
Validating plugin manifest: .../plugins/oci-marketplace/.claude-plugin/plugin.json
✔ Validation passed

$ claude plugin validate --strict .
Validating marketplace manifest: .../.claude-plugin/marketplace.json
✔ Validation passed
```

The repository validator emitted non-gating advice to add an installation line to README. The instruction remains pending until the full installation and usage flow is verified, as required by the documentation plan.

### Hosted Git registration

Commit `6faf23c` published the validated scaffold before the hosted-source test. Claude then cloned and registered the repository through its SSH Git URL at user scope:

```json
{
  "command": "marketplace-add",
  "outcome": "ok",
  "marketplace": "claude-oci-marketplace",
  "message": "...Successfully added marketplace: claude-oci-marketplace (declared in user settings)"
}
```

`claude plugin marketplace list` reports:

```text
❯ claude-oci-marketplace
  Source: Git (git@github.com:dmartinol/claude-oci-marketplace-poc.git)
```

### `/plugin` UI evidence

A real interactive Claude Code 2.1.296 session opened `/plugin` and showed:

- The **Marketplaces** tab listed `claude-oci-marketplace`, its SSH Git source, `1 available`, and `1 installed`.
- Searching the **Installed** tab for `oci-marketplace` displayed `OCI Marketplace` with type `Plugin` and source marketplace `claude-oci-marketplace`.

The verification session ran through the restricted executor and displayed unrelated `EPERM` errors from pre-existing `SessionStart` hooks attempting to create Claude session-environment files. Those errors did not prevent `/plugin` from loading or displaying the marketplace and plugin, and they are not caused by this component-free manager scaffold.

### Installation and enablement

The hosted marketplace plugin installed successfully at user scope:

```json
{
  "command": "install",
  "outcome": "ok",
  "plugin": "oci-marketplace@claude-oci-marketplace",
  "pluginId": "oci-marketplace@claude-oci-marketplace",
  "scope": "user",
  "message": "Successfully installed plugin: oci-marketplace@claude-oci-marketplace (scope: user)"
}
```

Current installed state:

```json
{
  "id": "oci-marketplace@claude-oci-marketplace",
  "version": "0.1.0",
  "scope": "user",
  "enabled": true,
  "projectEnabled": false
}
```

An explicit user-scope enable attempt returned `failureCode: "already_in_goal_state"` and `alreadyInGoalState: true`, confirming that installation had already enabled the plugin. `claude plugin details oci-marketplace` also resolves the expected display name, version, description, and marketplace source.

### T002 acceptance

- [x] A minimal marketplace and manager plugin shape passes `claude plugin validate`.
- [x] The repository can be added as a marketplace from its Git URL.
- [x] `/plugin` displays the marketplace and manager plugin.
- [x] The manager plugin can be installed and enabled.

### Conclusion

T002 passes. Stock Claude Code accepts the repository as a hosted marketplace, displays it in `/plugin`, and installs and enables its single manager plugin. T003 and T004 are ready to begin. No product requirement or decision change is required from this task.

