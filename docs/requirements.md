# Claude Marketplace Manager POC Requirements

## Goal and product boundary

Provide a general marketplace manager for stock Claude Code. It must list and register all Claude plugin marketplaces, including standard-only marketplaces, while preserving Claude's native plugin experience. OCI skill discovery, installation, and updates are an optional extension of that general marketplace management scope. The first demo environment is macOS.

The solution must integrate with Claude's standard plugin marketplace through one generic, non-conflicting custom command and mod UI. The manager lists all registered marketplace sources and supports adding standard or OCI-enabled marketplaces. When a marketplace has the extension-owned OCI catalog, the manager additionally offers OCI skill discovery and lifecycle operations. It must not fork Claude Code, override `/plugin`, or make a command-source marketplace adapter the primary OCI experience.

The regular `/plugin` UI remains Claude's native interface for browsing and managing standard marketplace plugins. The custom manager provides a unified view of registered marketplaces; OCI skills are an additional capability shown for OCI-enabled marketplaces and are not represented as separate Claude plugins.

## Requirements

| ID | Requirement |
| --- | --- |
| R1 | The POC shall run on stock Claude Code, with macOS as the first demo environment. |
| R2 | The repository shall be a valid Claude plugin marketplace displayed by `/plugin`, containing one marketplace manager plugin. Its custom UI shall list every marketplace registered in Claude, identify whether it is standard-only or OCI-enabled, and support adding marketplaces. OCI-enabled marketplaces additionally expose skill browsing and install/update actions without leaving Claude. Standard plugin browsing and installation remain available through Claude's native `/plugin` UI. |
| R3 | Each OCI-enabled marketplace shall keep Claude's `.claude-plugin/marketplace.json` standard and place OCI skill metadata in a separate extension-owned catalog file. Each catalog entry shall include at least a skill name, description, and OCI repository reference. |
| R4 | For OCI skill operations, the manager shall use `skillctl` to retrieve and unpack artifacts into ordinary Claude skill directories while reusing supported registry credentials. |
| R5 | For each installed OCI skill, the manager shall show its installed version, source registry, and resolved digest. |
| R6 | Installed and updated OCI skills shall follow Claude's standard discovery and reload lifecycle. The implementation may use `reloadSkills`, `/reload-skills`, `/reload-plugins`, or the next session as supported by the installed Claude version. Same-session reload is optional; no custom hot-reload mechanism is required. |
| R7 | The OCI extension shall check metadata for newer published digests on session startup and manual refresh. It shall not download artifact content until the user approves an install or update. |
| R8 | The OCI extension shall apply only user-selected skill updates. It shall stage and validate replacements before activation and preserve the working installation if retrieval, unpacking, validation, or replacement fails. |
| R9 | The POC shall deliver one marketplace manager plugin with mod UI, a `SessionStart` hook for OCI metadata checks, and a small shared deterministic helper for OCI artifact operations around `skillctl`. It shall not require a daemon. Mod support is required for the intended demo UX and must be verified in the feasibility spike. |
| R10 | The manager shall use a generic command name that does not collide with Claude's built-in aliases. The command shall support `list` for all registered marketplaces and `add <source>` at user scope with behavior equivalent to Claude's marketplace registration command. The selected command name is `/marketplace-manager`, subject to live availability validation before release. |
| R11 | A valid marketplace without the extension-owned OCI catalog shall remain registered, appear in the manager's marketplace list as standard-only, and remain usable through `/plugin`; it shall contribute no OCI skills to the OCI skill browser. |
| R12 | The manager shall use Claude's registered marketplace configuration as the authoritative source for its complete marketplace list and discover OCI catalogs from those registrations. Multiple OCI catalogs are supported. OCI skill identity shall follow `<skill-name>@<marketplace-name>`. |
| R13 | When OCI skill updates are available, the manager shall show a non-blocking indicator and one summary that allows per-skill selection. Applying selected updates shall require a native mod confirmation followed by Claude's standard permission flow. |
| R14 | Dismissing an OCI skill update alert shall suppress it for the remainder of the current session. The alert shall return on the next session startup or manual refresh while the newer digest remains available. |

## Demo acceptance

1. Validate the repository as a Claude marketplace and add it from its Git URL.
2. Confirm `/plugin` displays the marketplace and its OCI marketplace manager plugin.
3. Use the generic manager command to list all registered marketplaces and confirm standard-only and OCI-enabled entries are both visible and correctly classified.
4. Add a valid standard-only Claude marketplace through the manager and confirm it appears in the marketplace list, remains usable through `/plugin`, and adds no OCI skills.
5. Add two OCI-enabled marketplaces and confirm that their skills are identified as `<skill-name>@<marketplace-name>`.
6. Build and publish sample skill v1 to the locally supplied public Quay repository using `skillctl`.
7. Browse and install the sample skill from inside Claude without downloading artifact content before approval.
8. Show the installed version, source, and digest, then invoke the skill after the standard reload step required by the installed Claude version.
9. Publish v2 with visibly different behavior and detect it through manual refresh or the next session startup.
10. With more than one update available, show one non-blocking summary, select a subset, and dismiss it. Confirm that no artifact content is downloaded and the alert stays suppressed for the current session.
11. On the next startup or manual refresh, approve a selected update through the native mod confirmation and Claude permission flow, then invoke the updated skill after the applicable standard reload step.
12. Simulate a failed fetch or staging operation and confirm that the working installation remains usable.

The Quay namespace and credentials are supplied locally. Do not invent a usable image reference or commit credentials.

## Feasibility spike

Complete this spike before implementing the full workflow:

- Record the actual `claude --version` and `skillctl version` on the demo machine.
- Validate the repository shape expected by Claude's marketplace loader.
- Verify mod availability and the supported command, indicator, dialog, and permission APIs.
- Verify that `/marketplace-manager` is available and does not collide with any built-in command or alias on the supported Claude version. The prior T003 probe found that `/marketplace` conflicts with a built-in alias.
- Distinguish prompt-based skills from deterministic mod commands and UI actions.
- Verify how Claude's registered marketplace sources and local marketplace caches can be discovered without maintaining an independent registry.
- Prove that one deterministic action can call `skillctl`, unpack a skill, and make Claude discover it.
- Verify `SessionStart`, metadata-only digest checks, `reloadSkills`, `/reload-plugins`, and newly created skill directories against the installed Claude version.
- Determine the exact extension-owned OCI catalog filename and validate its minimum schema.
- Report evidence and blockers, then stop and wait for explicit approval before implementing the remaining workflow.

Validated findings accumulate in [feasibility-report.md](feasibility-report.md). Full implementation remains gated until the feasibility spike is complete and explicitly approved.

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

- Use minimal Claude marketplace and plugin metadata, a generic marketplace manager entry point, mod code, a startup hook, a small deterministic helper, optional extension-owned OCI catalogs, and sample skills.
- Keep filesystem and registry operations in code rather than model-generated shell actions.
- Treat Claude's registered marketplaces as authoritative; do not maintain a second independent marketplace registry.
- Do not download OCI artifact layers during browsing, startup checks, or manual refresh.
- Do not add an elaborate specification framework or per-release documentation for this POC.

