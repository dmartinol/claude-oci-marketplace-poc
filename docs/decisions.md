# Product Decisions

This document records agreed product choices and unresolved feasibility questions. Normative behavior belongs in [requirements.md](requirements.md).

## Accepted decisions

### D1 — Standard marketplace visibility

The regular `/plugin` UI remains Claude's native interface for standard marketplace plugins. The custom marketplace manager lists all registered marketplaces, including standard-only ones, and identifies OCI-enabled marketplaces. OCI skills appear in the manager's OCI extension view; standard plugin operations remain in `/plugin`.

### D2 — Marketplace add contract

The manager command is the generic `/marketplace-manager`, subject to validation against the supported Claude version's built-in command and alias set. It replaces the OCI-specific `/oci-marketplace` entry point; T003 found that `/marketplace` conflicts with a built-in alias. Its `list` action shows every Claude-registered marketplace; `add <source>` registers a standard or OCI-enabled marketplace at user scope through Claude's marketplace registration command and refreshes the complete list. The existing OCI skill commands remain an extension of this general manager. On Claude Code 2.1.299, T304 loaded and executed `/marketplace-manager list` from the marketplace manager plugin without a built-in command collision.

### D3 — OCI catalog separation

OCI metadata lives in a separate extension-owned `oci-catalog.json` at the marketplace root. Claude's `.claude-plugin/marketplace.json` remains standard. The catalog is an object with a `skills` array; each entry requires non-empty `name`, `description`, and `repository` strings. The `repository` is a tagged OCI image reference.

### D4 — Marketplace source of truth

Claude's registered marketplace configuration is authoritative. The manager discovers compatible catalogs from those registrations and does not maintain an independent marketplace registry.

### D5 — Multiple catalogs and identity

Multiple OCI-enabled marketplaces are supported. Skills use the standard marketplace-style identity `<skill-name>@<marketplace-name>`. Skill names must be unique within one catalog; the same name in separate marketplaces remains distinct. A marketplace without `oci-catalog.json` contributes no OCI skills.

### D6 — Standard-only marketplace compatibility

Adding a valid Claude marketplace without an OCI catalog still succeeds. It appears in the manager's all-marketplace list as standard-only, remains available through `/plugin`, and contributes no OCI skill entries to the OCI browser.

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

The manager enumerates all registered marketplaces through Claude Code's `claude plugin marketplace list --json` output and uses those registrations as the authoritative all-marketplace list. Each entry's `installLocation` is the authoritative content location. A marketplace is OCI-enabled only when it contains the finalized extension-owned catalog file; absence of that file classifies the marketplace as standard-only rather than hiding it. The manager does not create or maintain a second marketplace registry.

### D12 — `skillctl` distribution contract

The manager uses `skillctl` 0.4.0 to build, inspect, push, pull, and unpack OCI skill artifacts. A Claude-compatible artifact contains both `SKILL.md` and `skill.yaml`; `inspect` resolves the published digest without downloading layers, and `pull` retrieves and unpacks the artifact. A catalog's tagged repository reference selects the published artifact; SkillCard version and resolved digest come from `inspect` and are not stored in the catalog. The source registry is the host in the repository reference. Protected Quay credentials are reused from the local container credential stores.

### D13 — Respect the active Claude config directory for skills

When `CLAUDE_CONFIG_DIR` is set, the manager installs skills under `<CLAUDE_CONFIG_DIR>/skills` so Claude discovers them in that profile. With no override, it uses `~/.claude/skills`. This follows the active Claude configuration and preserves the marketplace-qualified directory name.

### D14 — General marketplace manager with OCI extension

Marketplace listing and source registration are the manager's general-purpose core and apply to standard as well as OCI-enabled Claude marketplaces. OCI catalog parsing, skill installation, and skill updates are optional capabilities layered onto entries that provide `oci-catalog.json`. Standard plugin browsing and installation continue through Claude's native `/plugin` interface. The user clarified this product scope on 2026-10-14; T304 implements it and records live validation.

## Open feasibility questions

None. The P0 feasibility questions are resolved, and the user has approved implementation beyond G1.

