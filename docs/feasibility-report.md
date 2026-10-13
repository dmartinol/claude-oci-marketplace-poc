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

## Mod APIs

**Task:** T003 — Verify the mod interaction model

**Result:** Pass

**Observed:** 2026-10-13 (Europe/Rome)

### Installed-version API evidence

Claude Code 2.1.296 loaded the manager as a mod from the standard plugin shape:

```text
plugins/oci-marketplace/
├── .claude-plugin/plugin.json
└── hooks/
    ├── hooks.json
    └── register.js
```

Loading that directory with `--plugin-dir` generated the installed version's TypeScript declarations under the ignored `.claude-plugin/types/` directory. Those declarations confirm:

- `$.command.register` registers deterministic slash commands.
- Command names permit letters, digits, `_`, and `-`, but not `:`.
- `$.ui.toast` provides a non-blocking plugin indicator.
- `$.ui.ask` opens Claude's native `AskUserQuestion` dialog.
- `$.tool.call` passes through the normal tool hooks, permission check, and approval dialog before running the tool.
- `$.ui.status` can show and clear a pending-operation line.

The initially tested name `/marketplace` was refused because Claude reserves it as a built-in alias for `/plugin`. The accepted, namespaced manager command is therefore:

```text
/oci-marketplace
```

The future URL-registration spelling is `/oci-marketplace add <git-url>`.

### Deterministic interaction spike

Plugin version 0.1.1 registers `/oci-marketplace` during `session.start`. Its temporary feasibility action is:

```text
/oci-marketplace verify-update-flow
```

That action performs this deterministic sequence:

1. Shows the non-blocking toast `A newer OCI skill digest is available.`
2. Opens a native `OCI update` dialog with `Apply update` and `Not now` choices.
3. Treats `Not now` as dismissal and performs no tool call.
4. After `Apply update`, shows a pending status and calls the built-in Bash tool with `skillctl --version`.
5. Lets Claude perform its standard permission check and display its standard approval screen before the command can run.

The permission screen identified the action as a Bash command from the `oci-marketplace` plugin, displayed its description and command, stated that approval was required, and offered `Yes` and `No`. Approving it completed with:

```text
oci-marketplace: Claude permission granted and skillctl verification completed.
```

The probe uses `skillctl --version` only to demonstrate the permission boundary; it does not retrieve or mutate OCI content. The full update summary, selection state, and session dismissal lifecycle remain assigned to T402.

### Hosted installation and validation

Commit `fc4d5d4` published the mod as plugin version 0.1.1. Claude refreshed the registered Git marketplace and updated the existing user-scope installation:

```json
{
  "plugin": "oci-marketplace@claude-oci-marketplace",
  "scope": "user",
  "updateOutcome": "updated",
  "oldVersion": "0.1.0",
  "newVersion": "0.1.1"
}
```

A fresh stock Claude session, started without `--plugin-dir`, successfully ran `/oci-marketplace` and the complete `verify-update-flow` sequence. This confirms the behavior comes from the marketplace-installed manager plugin rather than only from the development loader.

Strict validation reports the expected hooks and calls:

```text
hooks: session.start, command.run{command=oci-marketplace}
answers its own command: command.run{command=oci-marketplace}
calls: $.command.register, $.tool.call, $.ui.ask, $.ui.status, $.ui.toast
Validation passed
```

The mod test suite covers command registration, dismissal after the non-blocking indicator, and transition from native confirmation to the permissioned tool call:

```text
3 pass
0 fail
```

### T003 acceptance

- [x] Mod support is confirmed for Claude Code 2.1.296.
- [x] The deterministic command `/oci-marketplace` is registered and recorded.
- [x] A non-blocking toast and native confirmation dialog are demonstrated.
- [x] Confirmation transitions to Claude's standard permission flow and completes after explicit approval.

### Conclusion

T003 passes with no blocker. The installed Claude version supports the required deterministic command, non-blocking update indication, native confirmation, and standard permission transition. The exact command and available mod APIs are no longer open feasibility questions. Full update behavior remains out of scope until Gate G1 is cleared.

