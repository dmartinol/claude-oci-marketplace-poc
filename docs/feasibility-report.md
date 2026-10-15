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

A preliminary replacement using the shared sample name `claude-oci-demo` returned the original text after the file was changed. The cause was not isolated; a pre-existing same-name skill definition may have conflicted with the disposable project. The controlled unique-name replacement above is the passing result. The maintained manager must verify its on-disk namespacing when the same skill name is installed from multiple marketplaces.

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

## Feasibility summary and recommendation

**Task:** T008 — Publish the feasibility report

**Result:** Pass

**Observed:** 2026-10-14 (Europe/Rome)

### P0 results

| Task | Result | Requirements |
| --- | --- | --- |
| T001 — Demo environment | Pass | R1, R4, R9 |
| T002 — Standard marketplace | Pass | R2, R9 |
| T003 — Mod interaction | Pass | R2, R9, R13, R14 |
| T004 — Marketplace discovery | Pass | R10, R11, R12 |
| T005 — `skillctl` capabilities | Pass | R3, R4, R5, R7 |
| T006 — Skill discovery and reload | Pass, with same-name collision caveat recorded above | R6, R9 |
| T007 — OCI catalog contract | Pass with disposable fixtures | R3, R5, R12 |

Claude Code was 2.1.296 during T001/T002/T003 and 2.1.299 during T006. This is observed environment version drift between probe dates, not a feasibility failure. `skillctl` remained at 0.4.0.

### Requirement conflicts and limitations

No requirement conflicts were found, and no requirement changes are proposed. The P0 spike verifies feasibility prerequisites; it does not claim that the full demo acceptance flow has been implemented. In particular, transactional replacement and rollback (R8), update selection/dismissal behavior (R13/R14), and production validation by the maintained loader remain implementation work after G1. T007 validates the selected catalog contract with fixtures, not production code. T006's ambiguous preliminary same-name result is recorded; the actual manager must verify namespaced on-disk installation for same-named skills from different marketplaces.

### T008 acceptance

- [x] Commands, relevant output, observed APIs, and limitations are recorded.
- [x] Every open feasibility question in `docs/decisions.md` is answered or marked blocked.
- [x] Requirement conflicts and proposed changes are explicitly listed.
- [x] The report ends with a clear go, revise, or no-go recommendation.
- [x] Work stops at Gate G1.

### Recommendation

**Go to G1 review.** All P0 feasibility tasks are complete, and the prior reload and catalog questions in `docs/decisions.md` are resolved. Review this report and authorize full implementation explicitly before starting P1–P5. This recommendation does not clear G1 by itself.

## OCI-source marketplace compatibility spike

**Task:** T601 — Probe stock Claude compatibility for raw OCI source entries

**Result:** Strict validation rejects the raw OCI source; the user confirmed this is expected because the manager parses it. Native local Git marketplace registration succeeds. OCI entry visibility in native `/plugin` is not required by the accepted product direction.

**Observed:** 2026-10-15 (UTC), Linux sandbox; not the macOS demo host.

### Environment and command versions

```text
$ uname -a
Linux sandbox-codex-sandbox 6.12.7-200.fc41.aarch64 #1 SMP PREEMPT_DYNAMIC Fri Dec 27 17:14:27 UTC 2024 aarch64 aarch64 aarch64 GNU/Linux

$ git --version
git version 2.43.0

$ claude --version
2.1.299 (Claude Code)

$ skillctl version
unknown command "version" for "skillctl"

$ skillctl --version
skillctl version 0.4.0
```

The supported version switch is `skillctl --version`. The earlier P0 report records the macOS demo host as of 2026-10-13 (Claude Code 2.1.296, `skillctl` 0.4.0, Git 2.50.1); this session has no access to that host, so those values were not refreshed.

### Maintained repository shape

On Claude Code 2.1.299, both existing marketplace/plugin shapes still pass strict validation:

```text
$ claude plugin validate --strict .
✔ Validation passed

$ claude plugin validate --strict ./plugins/oci-marketplace
✔ Validation passed
```

The manager validation output listed the current `SessionStart` and `command.run` hooks and calls to `$.command.register`, `$.ui.toast`, `$.ui.ask`, `$.tool.call`, `$.ui.status`, `$.process.run`, and filesystem/store APIs. Prior evidence in T003/T006 and implementation task T304 records the deterministic command/UI/permission path, session hook/reload behavior, and successful `/marketplace-manager list` execution on Claude Code 2.1.299. That evidence applies to the mod API, not to the revised OCI-source manifest compatibility.

The available CLI exposes `claude plugin validate --strict` and native `claude plugin marketplace add <source>` / `list --json` commands. The manager's old authoritative discovery approach is recorded in T004/T201/T304: query Claude's registration list and read each reported `installLocation`. The manager must parse the raw OCI source from that installed marketplace content.

### Raw OCI source validation and registration

A disposable local Git working tree was created with `.claude-plugin/marketplace.json` containing a plugin entry with non-empty `name` and `description`, and the documented tagged reference `quay.io/dmartino/claude-oci-demo:0.2.0-draft` directly in `source` (no `oci://`). The initial validation also identified a reserved `claude-` plugin name; after changing only the entry name to `oci-demo`, strict validation isolated the source-field error:

```text
$ claude plugin validate --strict <temporary-marketplace-directory>
Validating marketplace manifest: .../.claude-plugin/marketplace.json
✘ Found 1 error:
  ❯ plugins.0.source: Invalid string: must start with "./"
✘ Validation failed
strict validation exit: 1
```

Native registration of that local Git working tree by directory path succeeded even though strict validation fails:

```text
$ CLAUDE_CONFIG_DIR=<disposable-profile> claude plugin marketplace add <local-git-directory> --scope user --json
{"command":"marketplace-add","outcome":"ok","marketplace":"oci-source-compatibility-probe", ...}

$ CLAUDE_CONFIG_DIR=<disposable-profile> claude plugin marketplace list --json
[{"name":"oci-source-compatibility-probe","source":"directory","path":"<local-git-directory>","installLocation":"<local-git-directory>"}]
```

The first disposable manifest used the reserved name `claude-oci-demo`; that produced a second strict validation error. The source-only result above uses `oci-demo` and is the controlling validation evidence. The CLI registration test used a local Git working tree because no separate demo marketplace Git URL was supplied in this session. No plugin install, `skillctl` pull, or registry request was invoked. The registration and `marketplace list` commands returned without starting an artifact operation. `/plugin` visibility and entry viewing were not checked because the sandbox cannot allocate a pseudo-terminal:

```text
$ exec_command(..., tty=true)
failed to openpty: Permission denied

$ script -q -c 'claude --version' /dev/null
script: failed to create pseudo-terminal: Permission denied
```

The user clarified on 2026-10-15 that strict-validator rejection is expected because the manager plugin parses the raw OCI source field; native Claude commands are not expected to parse it. The manager lists OCI qualified identities and installs them directly. No plugin install, `skillctl` pull, or registry request was invoked during registration. Deterministic tests now confirm that listing uses only `skillctl inspect` for installed update checks and never pulls artifact layers.

### Blocker and recommendation

Strict validation rejects the raw source as expected, and the user directed implementation to proceed with manager-owned parsing and retire legacy catalogs. The local marketplace directory registers successfully. The available host is Linux rather than macOS, no separate demo marketplace Git URL was supplied, and pseudo-terminal creation is denied; T605 therefore still needs the supplied host, URL, and registry access for the full human-run rehearsal. Native `/plugin` visibility for OCI entries is outside the accepted product scope. See [D15/D16](decisions.md#scope-revision--oci-source-marketplace-flow-2026-10-15) and [T601/G2](plan.md#p6--oci-source-marketplace-revision).

## ORAS plugin bundle feasibility spike

**Status:** Partially run; local ORAS packaging, digest-pinned round-trip, Claude validation, and persistent installation passed on macOS. Registry-backed checks remain unverified. This section tracks the revised requirement for complete Claude plugin bundles; earlier skillctl probes do not establish ORAS behavior.

The macOS host reports ORAS 1.3.4 and completed a local OCI-layout round-trip of the maintained manager plugin. No ORAS command against the configured registry has been recorded. The separate v1/v2 demo plugin is planned as project-owned source under T608. The previous T501 evidence reports HTTP 401 for supplied skillctl artifact references; that is not evidence that ORAS itself fails.

**Required inputs:** current Linux ARM64 host for the portable T607 checks, plus the registry repository and local credentials from the supplied demo configuration. The POC supplies the complete bundle and derives the tag: T607 uses `plugins/oci-marketplace`; T608 creates the v1/v2 demo plugin source. No prebuilt bundle or externally approved tag is required. The macOS first-demo acceptance remains under T613. Never expose credentials in this report.

**Evidence to record:** OS, Claude Code, ORAS, and Git versions; exact ORAS push, manifest-fetch, and pull commands and output; artifact/layer media types; title/version annotations; resolved digest; proof manifest checks do not fetch layers; credential reuse behavior; Claude plugin validation; supported persistent activation and reload behavior; and all blockers.

### Sandbox environment check (2026-10-15)

This check records the current workspace only; it is not the required macOS demo-machine spike.

```text
$ uname -a
Linux sandbox-codex-sandbox 6.12.7-200.fc41.aarch64 #1 SMP PREEMPT_DYNAMIC Fri Dec 27 14:17:27 UTC 2024 aarch64 aarch64 aarch64 GNU/Linux

$ claude --version
2.1.299 (Claude Code)

$ git --version
git version 2.43.0

$ oras version
/bin/bash: line 1: oras: command not found
```

The maintained manager plugin bundle at `plugins/oci-marketplace` passes `claude plugin validate --strict ./plugins/oci-marketplace` on this Claude version (exit 0). It contains `.claude-plugin/plugin.json` and hook files, but this validation does not test ORAS packaging, extraction, registry behavior, or persistent activation. The existing `examples/claude-oci-demo` and `examples/claude-oci-guide` directories are individual skills; they do not supply the v1/v2 complete plugin demo required by acceptance.

### Supported Claude install-path probe

To check the supported local plugin path without changing the default profile, I used a fresh temporary `CLAUDE_CONFIG_DIR` and the native CLI. Each command was a separate process:

```text
$ CLAUDE_CONFIG_DIR=<temporary-profile> claude plugin marketplace add "$PWD" --scope user --json
{"command":"marketplace-add","outcome":"ok","marketplace":"claude-oci-marketplace","message":"Successfully added marketplace: claude-oci-marketplace (declared in user settings)"}

$ CLAUDE_CONFIG_DIR=<temporary-profile> claude plugin marketplace list --json
[{"name":"claude-oci-marketplace","source":"directory","path":"<repository>","installLocation":"<repository>"}]

$ CLAUDE_CONFIG_DIR=<temporary-profile> claude plugin install marketplace-manager@claude-oci-marketplace --scope user --json
{"command":"install","outcome":"ok","plugin":"marketplace-manager@claude-oci-marketplace","pluginId":"marketplace-manager@claude-oci-marketplace","scope":"user","message":"Successfully installed plugin: marketplace-manager@claude-oci-marketplace (scope: user)"}

$ CLAUDE_CONFIG_DIR=<temporary-profile> claude plugin list --json
[{"id":"marketplace-manager@claude-oci-marketplace","version":"0.5.0","scope":"user","enabled":true,"installPath":"<temporary-profile>/plugins/cache/claude-oci-marketplace/marketplace-manager/0.5.0", ...}]
```

The later `plugin list` process reported the plugin enabled at user scope under the temporary profile's plugin cache. This demonstrates that Claude Code 2.1.299 accepts and persists the native CLI installation on this Linux host. It does not demonstrate command execution in an interactive session, restart/reload behavior, or macOS activation; the sandbox cannot provide the required interactive demo session.

A protected local container-auth file is present, but its contents were not read and its registry credentials have not been tested. An attempt to fetch the official ORAS v1.3.4 Linux arm64 release into `/tmp` failed before download:

```text
$ curl --fail --location --retry 2 --silent --show-error --output /tmp/oci-poc-oras-1.3.4/oras.tar.gz https://github.com/oras-project/oras/releases/download/v1.3.4/oras_1.3.4_linux_arm64.tar.gz
curl: (7) Failed to connect to github.com port 443 after 66 ms: Couldn't connect to server

$ git ls-remote https://github.com/oras-project/oras.git HEAD
fatal: unable to access 'https://github.com/oras-project/oras.git/': The requested URL returned error: 403
```

At the time of this Linux-only check, no ORAS executable was available and no registry request or artifact publication was attempted. Both the release download and GitHub source transport were unavailable from that sandbox. This check does not establish registry compatibility or macOS activation.

### macOS local artifact and activation check (2026-10-15)

This check ran on the requested Mac host. It used the maintained `plugins/oci-marketplace` plugin as a complete local bundle because the repository does not yet contain a separate complete v1/v2 demo plugin. No registry reference was used, no registry request was made, and no artifact was published to a registry.

```text
$ uname -a
Darwin 25.6.0 arm64

$ claude --version
2.1.300 (Claude Code)

$ git --version
git version 2.50.1 (Apple Git-155)

$ oras version
Version:    1.3.4+Homebrew
Go version: go1.27.0
OS/Arch:    darwin/arm64

$ claude plugin validate --strict ./plugins/oci-marketplace
✔ Validation passed
```

The initial archive kept the plugin directory as its root, so extraction produced `.claude-plugin/plugin.json` at the plugin root. Claude strict validation also passed against the extracted directory.

The following candidate media types were used for a **local OCI-layout probe only**. They are not yet confirmed for the supplied registry or finalized as the product contract:

- Artifact type: `application/vnd.dmartino.claude.plugin.v1`
- Archive layer type: `application/vnd.dmartino.claude.plugin.bundle.v1.tar+gzip`
- Title annotation: `org.opencontainers.image.title=marketplace-manager`
- Version annotation: `org.opencontainers.image.version=0.5.0`, matching `.claude-plugin/plugin.json`

Commands run from a temporary directory containing the archive:

```text
$ tar -czf marketplace-manager-0.5.0.tar.gz -C <repository>/plugins/oci-marketplace .

$ oras push --oci-layout layout:0.5.0 \
    --artifact-type application/vnd.dmartino.claude.plugin.v1 \
    --annotation org.opencontainers.image.title=marketplace-manager \
    --annotation org.opencontainers.image.version=0.5.0 \
    marketplace-manager-0.5.0.tar.gz:application/vnd.dmartino.claude.plugin.bundle.v1.tar+gzip
Pushed [oci-layout] layout:0.5.0
ArtifactType: application/vnd.dmartino.claude.plugin.v1
Digest: sha256:6612690be28f91c5ca0b402191b101774a1e1943e8162471e1c55179292b673b

$ oras manifest fetch --oci-layout --pretty layout:0.5.0
"mediaType": "application/vnd.oci.image.manifest.v1+json"
"artifactType": "application/vnd.dmartino.claude.plugin.v1"
"config.mediaType": "application/vnd.oci.empty.v1+json"
"layers[0].mediaType": "application/vnd.dmartino.claude.plugin.bundle.v1.tar+gzip"
"layers[0].digest": "sha256:f38f7a56ba7d043eafa1e903b217d967df34204cd7b7d7ad123252ad78fff2a5"
"org.opencontainers.image.title": "marketplace-manager"
"org.opencontainers.image.version": "0.5.0"

$ oras pull --oci-layout \
    layout@sha256:6612690be28f91c5ca0b402191b101774a1e1943e8162471e1c55179292b673b \
    -o pulled
Pulled [oci-layout] layout@sha256:6612690be28f91c5ca0b402191b101774a1e1943e8162471e1c55179292b673b

$ shasum -a 256 marketplace-manager-0.5.0.tar.gz pulled/marketplace-manager-0.5.0.tar.gz
f38f7a56ba7d043eafa1e903b217d967df34204cd7b7d7ad123252ad78fff2a5  marketplace-manager-0.5.0.tar.gz
f38f7a56ba7d043eafa1e903b217d967df34204cd7b7d7ad123252ad78fff2a5  pulled/marketplace-manager-0.5.0.tar.gz
```

The digest-pinned pull returned the same archive bytes. The fetched local manifest exposed the title/version annotations and layer metadata. This demonstrates ORAS CLI support for the candidate artifact layout, not metadata-only behavior over a registry or registry support for the candidate media types.

To check Claude's persistent activation path, the pulled archive was extracted under a disposable local marketplace and validated. With a fresh `CLAUDE_CONFIG_DIR`, native marketplace registration and installation succeeded; `claude plugin list --json` reported `marketplace-manager@t607-local-probe`, version `0.5.0`, `enabled: true`, with its install path under that profile's plugin cache. This proves the native local-marketplace install path for the extracted bundle. Interactive command execution and restart/reload behavior were not checked.

The isolated profile commands and relevant output were:

```text
$ CLAUDE_CONFIG_DIR=<isolated-profile> claude plugin marketplace add <temporary-marketplace> --scope user --json
{"command":"marketplace-add","outcome":"ok","marketplace":"t607-local-probe", ...}

$ CLAUDE_CONFIG_DIR=<isolated-profile> claude plugin install marketplace-manager@t607-local-probe --scope user --json
{"command":"install","outcome":"ok","plugin":"marketplace-manager@t607-local-probe","pluginId":"marketplace-manager@t607-local-probe","scope":"user", ...}

$ CLAUDE_CONFIG_DIR=<isolated-profile> claude plugin list --json
{"id":"marketplace-manager@t607-local-probe","version":"0.5.0","scope":"user","enabled":true,"installPath":"<isolated-profile>/plugins/cache/t607-local-probe/marketplace-manager/0.5.0", ...}
```

The registry-backed portion remains unverified. Existing `examples/claude-oci-demo` and `examples/claude-oci-guide` are individual skills, and their skill artifact references must not be reused for this workflow. The missing complete-plugin source and tag are project work, not external blockers: T607 will publish the maintained manager bundle under a project-generated spike tag, and T608 will add and publish the separate v1/v2 demo bundle. The remaining registry dependency is usable write/read access to the repository in the supplied configuration; registry manifest lookup, digest-pinned remote pull, and registry media-type support still need evidence. No credentials were read or printed.

### Offline raw-source parser and manager command check (Linux, 2026-10-15)

The raw-source parser and manager listing behavior do not require a live OCI reference. I ran the existing Claude plugin test suite in the Linux workspace:

```text
$ claude plugin test ./plugins/oci-marketplace
21 pass
0 fail
Ran 21 tests across 2 files.
```

`tests/marketplace.test.ts` covers raw tagged source parsing, malformed sources, mixed and standard-only marketplace entries, and marketplace-qualified identity. `tests/interaction.test.ts` verifies manager list/add paths with stubbed APIs; the list test asserts its only process call is `claude plugin marketplace list --json`. These tests perform no registry operation. The earlier T601 compatibility check records successful native registration of a local marketplace containing a raw OCI source, also without an OCI request. Together, the parser and local command behavior pass without OCI retrieval. This does not replace a fresh macOS interactive run against the supplied demo marketplace.

The separate complete v1/v2 demo plugin source is now maintained under `examples/oci-demo-plugin`; it is not required to test this offline parser behavior.

### Linux current-host feasibility check (2026-10-15)

Per D19, portable T607 checks are being run on this current Linux ARM64 host. This does not replace the macOS first-demo acceptance required by R1 and T613.

```text
$ uname -a
Linux sandbox-codex-sandbox 6.12.7-200.fc41.aarch64 #1 SMP PREEMPT_DYNAMIC Fri Dec 27 17:14:27 UTC 2024 aarch64 GNU/Linux

$ claude --version
2.1.299 (Claude Code)

$ git --version
git version 2.43.0

$ oras version
/bin/bash: line 1: oras: command not found

$ go version
/bin/bash: line 1: go: command not found

$ claude plugin validate --strict .
Validating marketplace manifest: <repository>/.claude-plugin/marketplace.json
✔ Validation passed

$ claude plugin validate --strict ./plugins/oci-marketplace
Validating plugin manifest: <repository>/plugins/oci-marketplace/.claude-plugin/plugin.json
Validating hooks: <repository>/plugins/oci-marketplace/hooks/hooks.json
✔ Validation passed
```

The official ORAS Linux ARM64 release could not be installed because this sandbox cannot connect to GitHub:

```text
$ curl --fail --location --retry 1 --max-time 30 --silent --show-error \
    --output /tmp/oras_1.3.4_linux_arm64.tar.gz \
    https://github.com/oras-project/oras/releases/download/v1.3.4/oras_1.3.4_linux_arm64.tar.gz
curl: (7) Failed to connect to github.com port 443 after 86 ms: Couldn't connect to server
```

The local container authentication config has a `quay.io` registry key. Credential values were not emitted or tested. A registry connectivity probe failed before reaching the registry API:

```text
$ curl --silent --show-error --max-time 10 --output /dev/null \
    --write-out 'quay status=%{http_code}\n' https://quay.io/v2/
curl: (7) Failed to connect to quay.io port 443 after 73 ms: Couldn't connect to server
quay status=000
```

No ORAS registry push, manifest lookup, or digest-pinned pull was attempted. The registry-backed artifact and layer media types therefore remain unverified. The previous macOS OCI-layout result is local-only evidence and does not prove Quay registry behavior.

The user explicitly authorized T607/T608 work on the current Linux platform on 2026-10-15. Gate G3 remains uncleared until the registry-backed spike evidence is complete; no registry compatibility is inferred from local packaging. See [T607 and Gate G3](plan.md#p2--oras-feasibility-and-approval-gate).

### Artifact ownership clarification (2026-10-15)

The earlier spike note referred to an “approved complete-plugin destination/reference” and a separately supplied bundle as blockers. D18 and the revised plan resolve that dependency: the repository's demo registry configuration supplies the repository and local credentials, while this project creates both plugin sources, packages them, and derives the spike and demo tags. The Mac local OCI-layout evidence above already uses the maintained manager plugin as the spike bundle. No registry publication has yet been attempted, so registry permission and behavior remain open feasibility checks.

