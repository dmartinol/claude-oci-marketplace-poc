# Product Decisions

This document records agreed product choices and unresolved feasibility questions. Normative behavior belongs in [requirements.md](requirements.md).

## Accepted decisions

### D1 — Standard marketplace visibility

The regular `/plugin` UI shows the OCI marketplace manager plugin. Individual OCI skills appear only in the manager's custom browser.

### D2 — Marketplace add contract

The manager command is `/oci-marketplace`. Its future `add <git-url>` action registers the URL at user scope with the same behavior as `claude plugin marketplace add <URL>`.

### D3 — OCI catalog separation

OCI metadata lives in a separate extension-owned catalog file. Claude's `.claude-plugin/marketplace.json` remains standard.

### D4 — Marketplace source of truth

Claude's registered marketplace configuration is authoritative. The manager discovers compatible catalogs from those registrations and does not maintain an independent marketplace registry.

### D5 — Multiple catalogs and identity

Multiple OCI-enabled marketplaces are supported. Skills use the standard marketplace-style identity `<skill-name>@<marketplace-name>`.

### D6 — Standard-only marketplace compatibility

Adding a valid Claude marketplace without an OCI catalog still succeeds. It remains available through `/plugin` and contributes no entries to the OCI browser.

### D7 — Update interaction

Available updates produce a non-blocking indicator and one summary with per-skill selection. Applying an update requires a native mod confirmation followed by Claude's standard permission flow.

Claude Code 2.1.296 supports this path with `$.ui.toast`, `$.ui.ask`, and a permission-checked `$.tool.call`. The manager may use `$.ui.status` while the permission request is pending.

### D8 — Alert dismissal

Dismissing an available-update alert suppresses it for the current session only. It returns at the next startup or manual refresh while the update remains applicable.

### D9 — Reload behavior

Install and update use only Claude's standard lifecycle: `reloadSkills`, `/reload-plugins`, or a new session, depending on actual support. Same-session reload is optional.

### D10 — Feasibility gate

Agents complete the feasibility spike, report evidence and blockers, and stop for explicit approval before implementing the full workflow. Unsupported mod behavior is a blocker to report, not permission to silently replace the intended UX.

### D11 — Registered marketplace discovery

The manager enumerates registered marketplaces through Claude Code's `claude plugin marketplace list --json` output, uses each entry's `installLocation` as the authoritative content location, and treats only marketplaces containing the finalized extension-owned catalog file as OCI-enabled. It does not create or maintain a second marketplace registry.

## Open feasibility questions

- Which `skillctl` version and commands support metadata resolution, authenticated retrieval, unpacking, and the required OCI artifact layout?
- Which standard mechanism makes newly installed or updated skills available: `reloadSkills`, `/reload-plugins`, or a new session?
- What exact filename and minimum schema should the extension-owned OCI catalog use?

