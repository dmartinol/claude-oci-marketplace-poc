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

## Marketplace discovery

**Task:** T004 — Verify registered-marketplace discovery

**Result:** Pass

**Observed:** 2026-10-14 (Europe/Rome)

### Authoritative enumeration

Claude Code 2.1.296 exposes user-level marketplace registrations through:

```text
claude plugin marketplace list --json
```

The command returns one object per configured marketplace with:

```text
name
source
url | repo | path
installLocation
```

Representative output from the demo environment:

```json
[
  {
    "name": "anthropic-agent-skills",
    "source": "github",
    "repo": "anthropics/skills",
    "installLocation": "/Users/dmartino/.claude/plugins/marketplaces/anthropic-agent-skills"
  },
  {
    "name": "claude-oci-marketplace",
    "source": "git",
    "url": "git@github.com:dmartinol/claude-oci-marketplace-poc.git",
    "installLocation": "/Users/dmartino/.claude/plugins/marketplaces/claude-oci-marketplace"
  }
]
```

The output is authoritative registration state and does not require the manager to maintain a second registry.

### Source-to-cache mapping

Every registration returned by `claude plugin marketplace list --json` includes an `installLocation`. For Git and GitHub sources, this value points to Claude's local marketplace cache under:

```text
~/.claude/plugins/marketplaces/<marketplace-name>
```

For a local directory source, Claude reports the source directory itself as `installLocation`. The manager therefore must use the returned `installLocation` rather than assume a fixed cache path.

The cached or source directory contains the standard marketplace manifest:

```text
<installLocation>/.claude-plugin/marketplace.json
```

### OCI and standard-only classification

A temporary OCI-enabled probe marketplace was registered alongside a standard-only probe. The OCI-enabled probe contained a provisional extension-owned catalog file at its marketplace root:

```text
<installLocation>/oci-catalog.json
```

The standard-only probe did not contain that file. Classification therefore reduces to:

```text
test -f "<installLocation>/<extension-owned-catalog>"
```

Observed classification:

```text
anthropic-agent-skills       standard-only
claude-code-plugins          standard-only
claude-oci-marketplace       standard-only
claude-t004-oci-enabled      OCI-enabled
claude-t004-standard-only    standard-only
mcp-apps                     standard-only
sdlc-plugins                 standard-only
```

The filename `oci-catalog.json` and its schema are provisional for this probe only. The final catalog filename and schema remain assigned to T007.

### Standard-only marketplace behavior

A temporary standard-only marketplace and plugin were validated, registered, listed, and installed through Claude's standard plugin path.

Strict marketplace validation succeeded:

```text
claude plugin validate /tmp/claude-t004-standard-only --strict --json
```

```json
{
  "success": true,
  "strict": true,
  "manifest": {
    "type": "marketplace",
    "errors": [],
    "warnings": []
  }
}
```

User-scope registration succeeded:

```text
claude plugin marketplace add ./claude-t004-standard-only --scope user --json
```

```json
{
  "command": "marketplace-add",
  "outcome": "ok",
  "marketplace": "claude-t004-standard-only",
  "message": "Successfully added marketplace: claude-t004-standard-only (declared in user settings)"
}
```

Claude listed the marketplace's plugin as available:

```text
standard-only-plugin@claude-t004-standard-only
```

The plugin installed successfully at user scope:

```json
{
  "command": "install",
  "outcome": "ok",
  "plugin": "standard-only-plugin@claude-t004-standard-only",
  "scope": "user"
}
```

`claude plugin details standard-only-plugin@claude-t004-standard-only` reported the expected plugin identity, version, source, and empty component inventory. The probe contributed no OCI entries.

After verification, the temporary plugin and both temporary marketplaces were removed successfully. No T004 probe remained in Claude's user-level registration or installed-plugin state.

### Observed limitations

- Claude rejected a `file://` Git URL with `invalid_source`. This does not invalidate the intended Git/HTTPS URL contract, which is already represented by the registered `claude-oci-marketplace` Git source.
- Local directory registrations use the source path as `installLocation` rather than copying it into Claude's marketplace cache. The manager must support both cached and direct-source locations.
- The OCI catalog filename and schema are not yet finalized; T007 owns that contract.

### T004 acceptance

- [x] User-level marketplace registrations can be enumerated.
- [x] Registered source URLs can be mapped to usable marketplace content or caches.
- [x] OCI-enabled and standard-only marketplaces can be distinguished.
- [x] Adding a standard-only marketplace retains standard Claude behavior.

### Conclusion

T004 passes with no blocker. Claude's `plugin marketplace list --json` output provides the authoritative marketplace enumeration and content location needed by the manager. A standard-only marketplace remains fully usable through Claude's normal plugin path and contributes no OCI entries. The exact OCI catalog filename and schema remain open for T007.

## skillctl

**Task:** T005 — Verify `skillctl` capabilities

**Result:** Pass

**Observed:** 2026-10-14 (Europe/Rome)

### Supported commands and artifact layout

`skillctl` 0.4.0 supports the operations required by the manager:

```text
build
inspect
install
list
pull
push
tag
validate
```

A Claude-compatible OCI skill artifact contains:

```text
<skill-name>/
├── SKILL.md
└── skill.yaml
```

`SKILL.md` supplies Claude’s standard skill instructions. `skill.yaml` supplies the SkillCard metadata used by `skillctl`. The purpose-built sample `claude-oci-demo` used both files and validated successfully:

```text
skillctl validate /tmp/claude-t005-skill
✓ /tmp/claude-t005-skill/skill.yaml is valid
```

The sample was built and tagged as:

```text
quay.io/dmartino/claude-oci-demo:0.1.1-draft
```

### Resolved digest without layer download

Remote metadata inspection succeeded without pulling the artifact layer:

```text
skillctl inspect quay.io/dmartino/claude-oci-demo:0.1.1-draft
```

Observed result:

```text
Skill:        quay.io/dmartino/claude-oci-demo
Version:      0.1.1
Digest:       sha256:3e842b281cf1d3bf0e8492ca6bcbd7e13b3cfb9c72e9383c1906d58b2d1802a3
Layers:       1
```

This confirms that the manager can resolve a published digest without downloading artifact content.

### Retrieval and unpacking

The published artifact was retrieved and unpacked with:

```text
skillctl pull quay.io/dmartino/claude-oci-demo:0.1.1-draft -o /tmp/claude-t005-pulled-0.1.1
```

Observed result:

```text
Pulled quay.io/dmartino/claude-oci-demo:0.1.1-draft
Digest: sha256:3e842b281cf1d3bf0e8492ca6bcbd7e13b3cfb9c72e9383c1906d58b2d1802a3
Unpacked to /tmp/claude-t005-pulled-0.1.1
```

The unpacked directory contained both `SKILL.md` and `skill.yaml`.

### Authentication and failure behavior

Protected Quay credentials were available in the local Docker and Podman credential stores and were reused by `skillctl`. No credential values were printed, decoded, copied, or committed.

Two failure modes were observed:

- Pushing a local reference directly to a remote name failed before registry access because the local store did not contain that remote reference.
- Pushing to the incorrect namespace `quay.io/dmartinol/claude-oci-demo` returned `401 Unauthorized`.

After tagging the local image to the correct supplied namespace and repository, the push succeeded:

```text
skillctl tag dmartino/claude-oci-demo:0.1.1-draft quay.io/dmartino/claude-oci-demo:0.1.1-draft
skillctl push quay.io/dmartino/claude-oci-demo:0.1.1-draft
Pushed quay.io/dmartino/claude-oci-demo:0.1.1-draft
```

### T005 acceptance

- [x] Supported commands and artifact layout are recorded.
- [x] A resolved digest can be obtained without downloading artifact layers.
- [x] One supplied or purpose-built sample skill can be retrieved and unpacked.
- [x] Authentication and common failure behavior are documented without exposing credentials.

### Conclusion

T005 passes with no blocker. `skillctl` 0.4.0 supports the required build, metadata inspection, authenticated push, retrieval, and unpacking workflow, and the sample artifact is compatible with Claude’s standard skill file layout.

## Skill reload

**Task:** T006 — Verify skill discovery and reload

**Result:** Pass

**Observed:** 2026-10-14 (Europe/Rome)

### Installed-version behavior

The installed Claude Code version at the time of this probe was 2.1.299. A disposable project used the sample files already unpacked in T005. A temporary `SessionStart` command hook copied the skill into the project's `.claude/skills/t006-startup-probe/` directory and returned:

```json
{"hookSpecificOutput":{"hookEventName":"SessionStart","reloadSkills":true}}
```

The first prompt in that same session invoked the newly unpacked skill successfully:

```text
$ claude -p "/t006-startup-probe" --max-budget-usd 0.15
T006 startup hook skill ready.
```

This verifies that `SessionStart` plus `reloadSkills: true` makes a hook-installed skill available to the first prompt. The command reference also exposes `/reload-skills` and `/reload-plugins` in the installed CLI:

```text
$ claude -p "/reload-skills" --max-budget-usd 0.05
Reloaded skills: 66 skills available (none added or removed). Claude will get the full list of skills with your next message.

$ claude -p "/reload-plugins" --max-budget-usd 0.05
Reloaded: 17 plugins · 47 skills · 20 agents · 9 hooks · 0 plugin LSP servers
```

An existing project skill directory was then replaced in place between two fresh sessions. The first invocation returned `T006 replacement v1 ready.`; after updating the same `SKILL.md`, the next session returned `T006 replacement v2 ready.`. This confirms the new-session fallback observes the replacement. The replacement fixture used a unique skill name to avoid conflating it with any pre-existing skill of the same name.

The official [Claude Code command reference](https://code.claude.com/docs/en/commands) describes `/reload-skills` as a skill and command directory rescan and `/reload-plugins` as reloading active plugins. The [hooks reference](https://code.claude.com/docs/en/hooks#sessionstart-decision-control) documents `SessionStart`'s `reloadSkills` field.

### T006 acceptance

- [x] A newly unpacked sample skill is discovered by Claude.
- [x] Replacement of an existing skill is tested.
- [x] `reloadSkills`, `/reload-plugins`, and next-session behavior are recorded as applicable.
- [x] The selected standard reload behavior is documented without adding custom hot reload.

### Conclusion

T006 passes with no blocker. Use Claude's standard `/reload-skills` refresh after an interactive install when same-session availability is desired; a fresh session also discovers replacement content. A `SessionStart` installer can return `reloadSkills: true` for skills it places before the first prompt. The manager requires no custom hot reload.

## OCI catalog

**Task:** T007 — Resolve the OCI catalog contract

**Result:** Pass

**Observed:** 2026-10-14 (Europe/Rome)

### Selected catalog contract

The extension-owned catalog is `oci-catalog.json` at the registered marketplace's root, alongside the standard `.claude-plugin/marketplace.json`. The minimum shape is an object with a `skills` array. Each entry requires non-empty `name`, `description`, and `repository` strings; `repository` is a tagged OCI image reference. For example:

```json
{
  "skills": [
    {
      "name": "claude-oci-demo",
      "description": "Demonstrates OCI skill distribution and reload behavior",
      "repository": "quay.io/dmartino/claude-oci-demo:0.1.1-draft"
    }
  ]
}
```

Catalog identity is `<skill-name>@<registered-marketplace-name>`. A skill name may appear once per catalog; repeated names within one catalog are invalid. The same name in separate OCI-enabled marketplaces yields separate entries. A registered marketplace without the root catalog remains a standard Claude marketplace and contributes no OCI entries.

The repository reference supplies the registry host, repository path, and tag used to inspect a publication. The tag is a lookup selector, not the SkillCard version. T005's verified `skillctl inspect` result for tag `0.1.1-draft` reported SkillCard version `0.1.1` and digest `sha256:3e842b281cf1d3bf0e8492ca6bcbd7e13b3cfb9c72e9383c1906d58b2d1802a3`. The catalog stores the tagged reference; it does not store version or digest. `inspect` supplies current version and resolved digest without downloading layers. The manager derives source registry from the reference's host.

### Fixture validation

The disposable fixture probe exercised the selected path, fields, identity, duplicates, and standard-only behavior. It did not alter Claude marketplace registrations or add a production parser:

```text
$ python3 /tmp/t007_catalog_probe.py
PASS: root filename/minimum fields; identities claude-oci-demo@marketplace-one != claude-oci-demo@marketplace-two
PASS: duplicate name rejected within one catalog (duplicate skill name in catalog: claude-oci-demo)
PASS: each required skill field is enforced
PASS: standard-only marketplace with no root catalog contributes zero OCI entries
PASS: T005 inspect evidence distinguishes tag, SkillCard version, and resolved digest
```

This validates the contract with disposable fixtures only. Validation by the maintained marketplace loader remains implementation work after Gate G1.

### T007 acceptance

- [x] The filename and discovery location are recorded.
- [x] Required catalog and skill fields are defined.
- [x] Version, tag, repository, and resolved-digest semantics are defined.
- [x] `<skill-name>@<marketplace-name>` identity and duplicate-name behavior are demonstrated.

### Conclusion

T007 passes with no blocker. The tested provisional filename is finalized as `oci-catalog.json`; the minimum contract follows R3, and T005's metadata-only inspection provides version and digest values. No requirement change is needed.

