# Claude Marketplace Manager POC Requirements

## Goal and product boundary

Provide a general marketplace manager for stock Claude Code. It must list and register all Claude plugin marketplaces, including standard-only marketplaces, while preserving Claude's native plugin experience. The first demo environment is macOS and uses two separate Git marketplace sources: this POC's bootstrap marketplace publishes the manager, and a demo marketplace publishes an OCI-backed plugin entry.

The developer builds and pushes the skill artifact from examples in the remote POC repository, without cloning the POC repository. The demo marketplace is added separately by its own Git URL. Its `.claude-plugin/marketplace.json` declares the OCI-backed plugin using a raw tagged OCI image reference in the plugin `source` field (for example, `quay.io/dmartino/claude-oci-demo:0.2.0-draft`, with the demo's configured reference authoritative). The manager uses this declaration to inspect, install, and update the OCI artifact.

The solution must integrate with Claude's standard plugin marketplace through one generic, non-conflicting custom command and mod UI. `/plugin` must continue to show registered marketplaces and their declared plugin entries; the manager owns OCI artifact installation and updates. Standard Git/local plugin sources remain managed through Claude's native `/plugin` interface. The solution must not fork Claude Code or override `/plugin`. Stock Claude compatibility of the OCI-source marketplace manifest is a required feasibility check before implementation.

## Requirements

| ID | Requirement |
| --- | --- |
| R1 | The POC shall run on stock Claude Code, with macOS as the first demo environment. |
| R2 | This repository shall remain a valid Claude plugin marketplace displayed by `/plugin`, containing the marketplace-manager plugin. The manager shall list every marketplace registered in Claude and support adding standard and OCI-source Git marketplaces. The separate demo marketplace and its OCI-backed plugin entry shall be visible through both the manager and `/plugin`. Users discover the OCI-backed entry in `/plugin`, install it by its marketplace-qualified identity through the manager, and use the manager to review and apply updates. Standard plugins remain usable through `/plugin`. |
| R3 | The demo marketplace shall declare the OCI-backed plugin in `.claude-plugin/marketplace.json` with a plugin `name`, `description`, and `source` containing the raw tagged OCI reference (no `oci://` prefix). The demo flow shall not require `oci-catalog.json`. OCI artifacts contain Agent Skills; the marketplace entry is the discoverable plugin-style declaration used by this POC. |
| R4 | For OCI-source plugin operations, the manager shall use `skillctl` to inspect, retrieve, validate, and unpack artifacts into ordinary Claude skill directories while reusing supported registry credentials. |
| R5 | For each installed OCI-source plugin, the manager shall show its marketplace-qualified identity, installed version, source registry, and resolved digest. |
| R6 | Installed and updated OCI artifacts shall follow Claude's standard skill discovery and reload lifecycle. The implementation may use `reloadSkills`, `/reload-skills`, `/reload-plugins`, or the next session as supported by the installed Claude version. Same-session reload is optional; no custom hot-reload mechanism is required. |
| R7 | The OCI extension shall inspect metadata for newer published digests on session startup and manual refresh. It shall not download artifact content until the user approves an install or update. A mutable tag updated in Quay shall be detected by its changed resolved digest. |
| R8 | The OCI extension shall apply only user-selected updates. It shall stage and validate replacements before activation and preserve the working installation if retrieval, digest verification, unpacking, validation, or activation fails. |
| R9 | The POC shall deliver one marketplace manager plugin with mod UI, a `SessionStart` hook for OCI metadata checks, and a small shared deterministic helper for OCI artifact operations around `skillctl`. It shall not require a daemon. Mod support is required for the intended demo UX and must be verified in the feasibility spike. |
| R10 | The manager shall use a generic command name that does not collide with Claude's built-in aliases. `/marketplace-manager` shall support `list`, `add <source>` at user scope with behavior equivalent to Claude's marketplace registration command, direct install by marketplace-qualified identity, installed-state display, and update review/application. It shall not provide a duplicate OCI browse command; discovery remains in `/plugin`. The selected command name is `/marketplace-manager`, subject to live availability validation before release. |
| R11 | A valid marketplace with no OCI-source plugin entries shall remain registered, appear in the manager's marketplace list as standard-only, and remain usable through `/plugin`. It shall contribute no OCI artifacts to manager install or update operations. |
| R12 | The manager shall use Claude's registered marketplace configuration as the authoritative source for its complete marketplace list and read marketplace content from Claude's registered install locations. It shall discover OCI artifacts from plugin entries whose `source` is a valid raw OCI reference. Multiple OCI-enabled marketplaces are supported. Identity shall follow `<plugin-name>@<marketplace-name>`. |
| R13 | When OCI skill updates are available, the manager shall show a non-blocking indicator and one summary that allows per-skill selection. Applying selected updates shall require a native mod confirmation followed by Claude's standard permission flow. |
| R14 | Dismissing an OCI skill update alert shall suppress it for the remainder of the current session. The alert shall return on the next session startup or manual refresh while the newer digest remains available. |

## Demo acceptance

1. Record Claude Code, `skillctl`, and Git versions. Use a fresh Claude config profile and a dedicated Quay repository/tag with push access; do not require an empty local `skillctl` image store or delete unrelated local images.
2. Build sample skill v1 from the POC repository's remote examples archive (no POC clone), validate it, push it to Quay, and record `skillctl inspect` version and digest.
3. Confirm the isolated Claude profile has no marketplaces or plugins. Add the POC bootstrap marketplace through Claude's native flow and install `marketplace-manager` through `/plugin`.
4. In Claude, run `/marketplace-manager add <demo-marketplace-Git-URL>` using the separate demo marketplace URL. Confirm the manager lists it and `/plugin` displays the demo marketplace and its OCI-backed plugin entry.
5. Install the OCI-backed plugin through the manager. Confirm there is no artifact pull before approval, approve the manager confirmation and Claude permission prompt, then verify the marketplace-qualified installed identity, version, registry, resolved digest, and skill files. Restart Claude and invoke the v1 skill response.
6. Build v2 from the remote examples archive and push it to the same mutable Quay tag. Confirm the version and resolved digest changed using `skillctl inspect`.
7. Start a new Claude session and confirm the manager reports the update. Use the manager's update command to review and approve it; confirm only the selected OCI artifact updates. Restart Claude and verify the installed record, digest, and distinct v2 skill response.
8. Verify a standard-only marketplace remains listed and usable through `/plugin` and contributes no OCI artifacts to manager install or update operations.
9. Simulate retrieval, digest, validation, and activation failures and confirm that an existing working installation remains usable.

The demo skill is `claude-oci-demo`: v1 responds `T005 sample skill ready.` and v2 responds `T005 sample skill updated to v0.2.0.`

The demo marketplace Git URL and Quay reference must be explicitly supplied by the demo setup. The user may use the published demo values or adapt the demo marketplace to a Quay repository they control. Never invent registry coordinates or commit credentials.

## Additional implementation tasks for the OCI-source marketplace flow

The existing manager currently classifies marketplaces by checking for root `oci-catalog.json`, discovers OCI skills from that catalog, and implements `add <source>` by invoking `claude plugin marketplace add --scope user`. It does not currently parse OCI references from plugin `source` fields. The existing demo guide therefore does not validate the flow specified above.

Complete these tasks before publishing the human-run demo guide:

1. **Stock Claude compatibility probe:** Create a disposable demo marketplace manifest with a raw Quay reference in `plugins[].source`. Record the Claude version and verify strict validation, Git marketplace registration, visibility of both marketplace and plugin in `/plugin`, and that registration or viewing the entry does not attempt an OCI install. If stock Claude rejects or hides the entry, report the observed behavior and stop for a product decision; do not silently revert the demo to `oci-catalog.json`.
2. **Marketplace discovery and classification:** Extend the manager to inspect registered marketplace content and recognize OCI-source plugin entries, while preserving complete Claude marketplace listing, standard-only classification, and native standard-plugin use. Decide and document whether the existing `oci-catalog.json` format remains supported for backward compatibility or is retired; do not make the demo depend on it.
3. **OCI lifecycle:** Route OCI-source entries through `skillctl inspect`, approval-gated pull/install, installed-state reporting, startup update detection, selected updates, and safe replacement/rollback. Preserve marketplace-qualified identity and ensure same-tag digest changes trigger the update path.
4. **Command and coverage cleanup:** Remove the redundant `browse` command and its chooser from the plugin, tests, help text, and user documentation. Add deterministic coverage for OCI-source parsing, valid and invalid references, standard-only and mixed marketplaces, `/plugin` visibility compatibility, metadata-only update checks, direct install by qualified identity, approval/permission denial, reload, same-tag updates, and rollback failures.
5. **End-to-end rehearsal:** Run the acceptance flow from a fresh Claude profile with the bootstrap and demo Git URLs kept distinct. Record commands, versions, marketplace/plugin visibility, `skillctl inspect` digests, restart behavior, and any blockers without sharing profile or registry authentication data.
6. **Documentation:** After the flow passes, replace the catalog-based procedure in `docs/demo/README.md` with the runnable OCI-source workflow, concise prerequisites, the remote build steps, the separate marketplace URL, expected v1/v2 responses, evidence gates, and cleanup.

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
- For the new OCI-source flow, verify stock Claude's accepted marketplace manifest shape and the visibility of the OCI-backed entry before implementation.
- Report evidence and blockers, then stop and wait for explicit approval before implementing the remaining workflow.

Validated findings accumulate in [feasibility-report.md](feasibility-report.md). Full implementation remains gated until the feasibility spike is complete and explicitly approved.

## Out of scope

- Native OCI support in or changes to Claude's `/plugin` implementation.
- Packaging OCI artifacts as full Claude plugin bundles; the marketplace entry is plugin-style metadata, while the OCI payload remains an Agent Skill managed by this POC.
- A command-source marketplace adapter as the primary OCI UX.
- Compass integration or consumption tracking.
- Registry webhooks, push notifications, background polling, or a daemon.
- Security advisory processing or signature enforcement.
- Platforms beyond the initial macOS demo.

This POC demonstrates distribution and updates, not a complete secure supply chain. Signing can follow after actual `skillctl` support is verified.

## Implementation constraints

- Use minimal Claude marketplace and plugin metadata, a generic marketplace manager entry point, mod code, a startup hook, a small deterministic helper, OCI-source marketplace entries, and sample skills. Keep `oci-catalog.json` only if the delegated implementation explicitly retains it for compatibility; the new demo must not depend on it.
- Keep filesystem and registry operations in code rather than model-generated shell actions.
- Treat Claude's registered marketplaces as authoritative; do not maintain a second independent marketplace registry.
- Do not download OCI artifact layers during browsing, startup checks, or manual refresh.
- Do not add an elaborate specification framework or per-release documentation for this POC.

