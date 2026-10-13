# Claude OCI Marketplace POC Requirements

## Goal and product boundary

Provide a marketplace experience in stock Claude Code for browsing, installing, using, and updating skills distributed as OCI artifacts. The first demo environment is macOS.

The solution is an extension-managed marketplace. It must integrate with Claude's standard plugin marketplace while using a namespaced custom marketplace command and mod UI to manage OCI skills. It must not fork Claude Code, override `/plugin`, or make a command-source marketplace adapter the primary OCI experience.

The regular `/plugin` UI exposes the OCI marketplace manager plugin. Individual OCI skills are browsed and managed through the manager's custom UI rather than represented as separate Claude plugins.

## Requirements

| ID | Requirement |
| --- | --- |
| R1 | The POC shall run on stock Claude Code, with macOS as the first demo environment. |
| R2 | The repository shall be a valid Claude plugin marketplace displayed by `/plugin`, containing one OCI marketplace manager plugin. The manager shall let users browse OCI skills and select install or update actions without leaving Claude. |
| R3 | Each OCI-enabled marketplace shall keep Claude's `.claude-plugin/marketplace.json` standard and place OCI skill metadata in a separate extension-owned catalog file. Each catalog entry shall include at least a skill name, description, and OCI repository reference. |
| R4 | The manager shall use `skillctl` to retrieve and unpack OCI artifacts into ordinary Claude skill directories while reusing supported registry credentials. |
| R5 | For each installed OCI skill, the manager shall show its installed version, source registry, and resolved digest. |
| R6 | Installed and updated skills shall follow Claude's standard discovery and reload lifecycle. The implementation may use `reloadSkills`, `/reload-plugins`, or the next session as supported by the installed Claude version. Same-session reload is optional; no custom hot-reload mechanism is required. |
| R7 | The manager shall check metadata for newer published digests on session startup and manual refresh. It shall not download artifact content until the user approves an install or update. |
| R8 | The manager shall apply only user-selected updates. It shall stage and validate replacements before activation and preserve the working installation if retrieval, unpacking, validation, or replacement fails. |
| R9 | The POC shall deliver one manager plugin with mod UI, a `SessionStart` hook, and a small shared deterministic helper around `skillctl`. It shall not require a daemon. Mod support is required for the intended demo UX and must be verified in the feasibility spike. |
| R10 | The manager's namespaced marketplace command shall support `add <git-url>` at user scope with behavior equivalent to `claude plugin marketplace add <URL>`. |
| R11 | A valid Claude marketplace without the extension-owned OCI catalog shall remain successfully registered and usable through `/plugin`; it shall contribute no skills to the OCI browser. |
| R12 | The manager shall discover compatible OCI catalogs from Claude's registered marketplaces, which are the authoritative marketplace configuration. Multiple OCI catalogs are supported. OCI skill identity shall follow `<skill-name>@<marketplace-name>`. |
| R13 | When updates are available, the manager shall show a non-blocking indicator and one summary that allows per-skill selection. Applying selected updates shall require a native mod confirmation followed by Claude's standard permission flow. |
| R14 | Dismissing an update alert shall suppress it for the remainder of the current session. The alert shall return on the next session startup or manual refresh while the newer digest remains available. |

## Demo acceptance

1. Validate the repository as a Claude marketplace and add it from its Git URL.
2. Confirm `/plugin` displays the marketplace and its OCI marketplace manager plugin.
3. Add a valid standard-only Claude marketplace through the manager command and confirm that registration succeeds without adding OCI entries.
4. Add two OCI-enabled marketplaces and confirm that their skills are identified as `<skill-name>@<marketplace-name>`.
5. Build and publish sample skill v1 to the locally supplied public Quay repository using `skillctl`.
6. Browse and install the sample skill from inside Claude without downloading artifact content before approval.
7. Show the installed version, source, and digest, then invoke the skill after the standard reload step required by the installed Claude version.
8. Publish v2 with visibly different behavior and detect it through manual refresh or the next session startup.
9. With more than one update available, show one non-blocking summary, select a subset, and dismiss it. Confirm that no artifact content is downloaded and the alert stays suppressed for the current session.
10. On the next startup or manual refresh, approve a selected update through the native mod confirmation and Claude permission flow, then invoke the updated skill after the applicable standard reload step.
11. Simulate a failed fetch or staging operation and confirm that the working installation remains usable.

The Quay namespace and credentials are supplied locally. Do not invent a usable image reference or commit credentials.

## Feasibility spike

Complete this spike before implementing the full workflow:

- Record the actual `claude --version` and `skillctl version` on the demo machine.
- Validate the repository shape expected by Claude's marketplace loader.
- Verify mod availability and the supported command, indicator, dialog, and permission APIs.
- Verify the actual namespaced marketplace command; do not assume unqualified `/marketplace` registration works.
- Distinguish prompt-based skills from deterministic mod commands and UI actions.
- Verify how Claude's registered marketplace sources and local marketplace caches can be discovered without maintaining an independent registry.
- Prove that one deterministic action can call `skillctl`, unpack a skill, and make Claude discover it.
- Verify `SessionStart`, metadata-only digest checks, `reloadSkills`, `/reload-plugins`, and newly created skill directories against the installed Claude version.
- Determine the exact extension-owned OCI catalog filename and validate its minimum schema.
- Report evidence and blockers, then stop and wait for explicit approval before implementing the remaining workflow.

Documentation is a starting point; no local integration has been validated yet.

## Out of scope

- Native OCI support in or changes to Claude's `/plugin` implementation.
- Representing every OCI skill as an individual Claude plugin.
- A command-source marketplace adapter as the primary OCI UX.
- Compass integration or consumption tracking.
- Registry webhooks, push notifications, background polling, or a daemon.
- Security advisory processing or signature enforcement.
- Platforms beyond the initial macOS demo.

This POC demonstrates distribution and updates, not a complete secure supply chain. Signing can follow after actual `skillctl` support is verified.

## Implementation constraints

- Use minimal Claude marketplace and plugin metadata, a namespaced marketplace entry point, mod code, a startup hook, a small deterministic helper, extension-owned OCI catalogs, and one sample skill.
- Keep filesystem and registry operations in code rather than model-generated shell actions.
- Treat Claude's registered marketplaces as authoritative; do not maintain a second independent marketplace registry.
- Do not download OCI artifact layers during browsing, startup checks, or manual refresh.
- Do not add an elaborate specification framework or per-release documentation for this POC.

