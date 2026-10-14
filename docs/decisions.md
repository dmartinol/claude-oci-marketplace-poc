# Product Decisions

This document records agreed product choices and unresolved feasibility questions. Normative behavior belongs in [requirements.md](requirements.md).

## Accepted decisions

### D1 — Standard marketplace visibility

The regular `/plugin` UI shows the OCI marketplace manager plugin. Individual OCI skills appear only in the manager's custom browser.

### D2 — Marketplace add contract

The manager command is `/oci-marketplace`. Its future `add <git-url>` action registers the URL at user scope with the same behavior as `claude plugin marketplace add <URL>`.

### D3 — OCI catalog separation

OCI metadata lives in a separate extension-owned `oci-catalog.json` at the marketplace root. Claude's `.claude-plugin/marketplace.json` remains standard. The catalog is an object with a `skills` array; each entry requires non-empty `name`, `description`, and `repository` strings. The `repository` is a tagged OCI image reference.

### D4 — Marketplace source of truth

Claude's registered marketplace configuration is authoritative. The manager discovers compatible catalogs from those registrations and does not maintain an independent marketplace registry.

### D5 — Multiple catalogs and identity

Multiple OCI-enabled marketplaces are supported. Skills use the standard marketplace-style identity `<skill-name>@<marketplace-name>`. Skill names must be unique within one catalog; the same name in separate marketplaces remains distinct. A marketplace without `oci-catalog.json` contributes no OCI skills.

### D6 — Standard-only marketplace compatibility

Adding a valid Claude marketplace without an OCI catalog still succeeds. It remains available through `/plugin` and contributes no entries to the OCI browser.

### D7 — Update interaction

Available updates produce a non-blocking indicator and one summary with per-skill selection. Applying an update requires a native mod confirmation followed by Claude's standard permission flow.

Claude Code 2.1.296 supports this path with `$.ui.toast`, `$.ui.ask`, and a permission-checked `$.tool.call`. The manager may use `$.ui.status` while the permission request is pending.

### D8 — Alert dismissal

Dismissing an available-update alert suppresses it for the current session only. It returns at the next startup or manual refresh while the update remains applicable.

### D9 — Reload behavior

Install and update use Claude's standard lifecycle. On Claude Code 2.1.299, a `SessionStart` hook can return `reloadSkills: true` so a skill installed by that hook is available to the first prompt; `/reload-skills` re-scans skill and command directories, `/reload-plugins` reloads active plugins, and a new session discovers a replacement. The POC should use the standard refresh command after interactive installs and may require a new session when needed. No custom hot-reload mechanism is required.

### D10 — Feasibility gate

Agents complete the feasibility spike, report evidence and blockers, and stop for explicit approval before implementing the full workflow. Unsupported mod behavior is a blocker to report, not permission to silently replace the intended UX.

The spike was approved for full implementation on 2026-10-14; Gate G1 is cleared. The same-name skill collision caveat is accepted as a demo limitation that can be avoided by using unique skill names in the demo catalogs.

### D11 — Registered marketplace discovery

The manager enumerates registered marketplaces through Claude Code's `claude plugin marketplace list --json` output, uses each entry's `installLocation` as the authoritative content location, and treats only marketplaces containing the finalized extension-owned catalog file as OCI-enabled. It does not create or maintain a second marketplace registry.

### D12 — `skillctl` distribution contract

The manager uses `skillctl` 0.4.0 to build, inspect, push, pull, and unpack OCI skill artifacts. A Claude-compatible artifact contains both `SKILL.md` and `skill.yaml`; `inspect` resolves the published digest without downloading layers, and `pull` retrieves and unpacks the artifact. A catalog's tagged repository reference selects the published artifact; SkillCard version and resolved digest come from `inspect` and are not stored in the catalog. The source registry is the host in the repository reference. Protected Quay credentials are reused from the local container credential stores.

### D13 — Respect the active Claude config directory for skills

When `CLAUDE_CONFIG_DIR` is set, the manager installs skills under `<CLAUDE_CONFIG_DIR>/skills` so Claude discovers them in that profile. With no override, it uses `~/.claude/skills`. This follows the active Claude configuration and preserves the marketplace-qualified directory name.

## Open feasibility questions

None. The P0 feasibility questions are resolved, and the user has approved implementation beyond G1.

