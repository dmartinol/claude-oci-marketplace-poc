# Claude Marketplace Manager POC Requirements

## Goal and product boundary

Provide a general marketplace manager for stock Claude Code. It lists and registers Claude plugin marketplaces, including standard-only marketplaces, and preserves Claude's in-Claude plugin experience. The first demo environment is macOS. The POC's bootstrap Git marketplace publishes the manager plugin; a separate Git marketplace declares OCI-backed plugin entries.

An OCI-backed marketplace entry represents a complete Claude plugin bundle. Its raw tagged OCI reference is stored in the entry's source field and is parsed by marketplace-manager. The OCI payload is the complete plugin directory, including its Claude plugin manifest and all components present in that directory. It is not an individual skillctl artifact.

The manager owns OCI plugin discovery, installation, and updates. Claude's built-in validator and marketplace UI do not need to understand the manager-owned OCI source value; strict validation rejection of that value is expected. Standard Git and local plugin sources remain managed by Claude's native plugin interface. Do not fork Claude Code or override its built-in plugin command.

## Requirements

| ID | Requirement |
| --- | --- |
| R1 | The POC shall run on stock Claude Code, with macOS as the first demo environment. |
| R2 | This repository shall remain a valid Claude plugin marketplace displayed by the native plugin UI and contain the marketplace-manager plugin. The manager shall list every marketplace registered in Claude and support adding standard and OCI-source Git marketplaces. It shall show OCI entries by marketplace-qualified identity for direct install and update review. |
| R3 | The demo marketplace shall declare each OCI-backed plugin in .claude-plugin/marketplace.json with name, description, and source containing a raw tagged OCI reference, without an oci:// prefix. Do not use or support oci-catalog.json. The marketplace entry is manager-owned metadata; its OCI payload is a complete Claude plugin bundle. |
| R4 | Publishers shall package the complete valid Claude plugin directory as a compressed tar archive and publish it as a generic OCI artifact with ORAS. The extracted archive root shall contain .claude-plugin/plugin.json and retain the plugin's original directory layout and components. The OCI artifact shall use the project-defined Claude plugin artifact type and layer media type selected and recorded by the feasibility spike. The OCI manifest shall include org.opencontainers.image.title and org.opencontainers.image.version annotations matching the plugin name and version in plugin.json. |
| R5 | The manager shall use ORAS for metadata lookup and artifact retrieval through deterministic code. It shall reuse supported local registry credentials without printing, persisting, or committing credentials. For installed plugins, it shall show marketplace-qualified identity, plugin version, source registry, resolved digest, and installed state. |
| R6 | Installation and update shall fetch the inspected digest only after user confirmation and Claude's standard permission approval. The manager shall stage and verify the complete bundle, validate the extracted plugin directory with Claude's supported plugin validator, and activate it through a supported Claude plugin installation path. It shall respect the active Claude config directory. It shall not directly manipulate undocumented Claude cache or settings formats. |
| R7 | Session-start and manual update checks shall query OCI manifest metadata without downloading artifact layers. The manager shall detect a changed digest when a mutable source tag moves and may display the OCI version annotation when available. Listing marketplaces and entries shall not contact the registry. |
| R8 | The manager shall apply only user-selected plugin updates. It shall validate staged replacements before activation and preserve the working installation and record if retrieval, digest verification, extraction, validation, or activation fails. |
| R9 | The POC shall provide one marketplace-manager plugin, mod UI, a SessionStart hook for OCI metadata checks, and a small deterministic helper for ORAS operations. It shall not require a daemon. |
| R10 | The generic command /marketplace-manager shall support list, add <source> at user scope, direct install by marketplace-qualified identity, installed-state display, and update review/application. It shall not provide a separate OCI browse chooser. Standard plugin discovery and operations remain available through Claude's native plugin interface. Validate that the command does not collide with a built-in name or alias on the supported Claude version. |
| R11 | A valid marketplace with no OCI-source plugin entries shall remain registered, appear in the manager's list as standard-only, and remain usable through Claude's native plugin interface. It shall contribute no OCI artifacts to manager install or update operations. |
| R12 | Claude's registered marketplace configuration shall remain authoritative for the complete marketplace list. The manager shall read registered content from Claude's reported install locations and discover OCI plugins from entries whose source is a valid raw OCI reference. Support multiple OCI-enabled marketplaces and use identity <plugin-name>@<marketplace-name>. |
| R13 | When OCI plugin updates are available, the manager shall show a non-blocking indicator and a consolidated summary that allows per-plugin selection. Applying selected updates shall require native mod confirmation followed by Claude's standard permission flow. |
| R14 | Dismissing an OCI plugin update alert shall suppress it for the remainder of the current session. The alert shall return on the next session startup or manual refresh while the newer digest remains available. |

## Demo acceptance

1. Record the macOS, Claude Code, ORAS, and Git versions on the demo machine. Use a fresh Claude config profile and an explicitly supplied OCI repository/tag with push access. Do not require an empty ORAS cache or remove unrelated local artifacts.
2. Assemble a complete, valid sample plugin from the supplied POC example source without cloning the POC repository. Package the full plugin root, publish it with ORAS to the supplied registry reference, and record the OCI artifact type, version annotation, manifest digest, and commands.
3. Confirm the isolated Claude profile has no marketplaces or plugins. Add the POC bootstrap marketplace through Claude's native flow and install marketplace-manager through the native plugin interface.
4. Add the separate demo Git marketplace through /marketplace-manager. Confirm that the manager lists its raw OCI plugin identity and that listing did not fetch OCI layers.
5. Install the OCI plugin through the manager. Confirm there is no artifact retrieval before approval, approve the manager confirmation and Claude permission prompt, then verify the marketplace-qualified identity, plugin version, source registry, resolved digest, complete plugin files, and activation in Claude. Restart Claude and exercise the plugin's v1 component.
6. Publish v2 of the complete plugin bundle to the same mutable tag. Confirm its version annotation and resolved digest changed.
7. Start a new Claude session and confirm the manager reports the update. Review and approve the selected plugin update. Restart Claude and verify the installed record, digest, and distinct v2 component behavior.
8. Verify that a standard-only marketplace remains listed and usable through Claude's native plugin interface and contributes no OCI operations.
9. Inject retrieval, digest, extraction, validation, and activation failures. Confirm that the previous working plugin remains active and its installed-state record remains unchanged.

The sample plugin's exact invocation and v1/v2 responses shall be recorded with its supplied source. Registry references, Git URLs, and credentials must come from the demo setup; never invent registry coordinates or commit credentials.

## Additional implementation tasks for the OCI-source marketplace flow

The current implementation uses skillctl to distribute individual Agent Skills. That behavior does not satisfy this revised full-plugin requirement. Treat all prior skillctl plugin-payload demonstrations as historical evidence only. Do not reuse a skill artifact reference as a complete plugin bundle reference.

1. **ORAS and stock Claude feasibility spike:** Before implementing the ORAS lifecycle, record actual versions and commands on the demo machine. Test generic artifact push, metadata-only manifest lookup, authenticated pull by digest, and the supplied registry's support for the selected artifact and layer media types. Package and validate one complete plugin directory. Verify raw-source marketplace registration and manager parsing without artifact retrieval. Prove a supported, persistent Claude activation path for the extracted plugin without editing undocumented cache or settings files. Strict validator rejection of the raw OCI source is expected. If registry access, manager parsing, digest metadata, plugin validation, or persistent activation fails, record the evidence and stop for a product decision.
2. **Marketplace discovery:** Preserve all registered marketplace listing and standard-only behavior. Read OCI plugin references from raw plugins[].source values and retire all oci-catalog.json parsing and fixtures.
3. **ORAS lifecycle:** Replace skillctl plugin payload operations with ORAS manifest lookup and digest-pinned artifact retrieval. Store plugin identity, version, registry, digest, source marketplace, and activation location. Stage, validate, activate, update, and roll back complete plugin directories.
4. **Claude activation:** Implement only the supported persistent activation route demonstrated by the feasibility spike. Preserve plugin components and standard Claude behavior. Respect the active Claude config directory.
5. **Manager UX and state:** Change OCI-facing labels, selection summaries, stored records, commands, and help from individual skills to plugins. Retain direct marketplace-qualified install and per-plugin update selection.
6. **Coverage:** Add deterministic coverage for archive and media-type validation, raw OCI source parsing, mixed and standard-only marketplaces, metadata-only digest checks, no retrieval before approval, digest-pinned pulls, complete plugin validation, activation, same-tag updates, permission denial, and rollback failures.
7. **End-to-end rehearsal:** Run the acceptance flow on a fresh macOS Claude profile with distinct bootstrap and demo Git sources and the supplied registry configuration. Record versions, commands, outputs, digests, activation, restart behavior, and blockers without exposing credentials.
8. **Documentation:** After the flow passes, publish a runnable demo guide with prerequisites, full-plugin packaging and ORAS commands, the supplied registry reference, separate marketplace URL, expected v1/v2 behavior, evidence gates, and cleanup.

## Feasibility spike

Complete this spike before implementing the full marketplace workflow:

- Record the actual demo OS, claude --version, oras version, and git --version.
- Validate the maintained bootstrap marketplace and manager plugin shape.
- Verify the mod APIs for commands, indicators, dialogs, and permission-gated actions.
- Verify that /marketplace-manager is available and does not collide with a built-in command or alias.
- Record the ORAS artifact packaging contract, including artifact type, layer media type, archive layout, annotations, manifest digest, and registry behavior.
- Verify that manifest lookup returns digest and version metadata without downloading artifact layers.
- Verify authenticated retrieval by digest from the supplied registry using supported local credentials.
- Validate the extracted complete plugin directory with Claude and demonstrate persistent activation through a supported local plugin path.
- Verify raw-source marketplace registration, manager parsing, and no OCI retrieval during registration or listing. The built-in /plugin interface is not required to parse the manager-owned OCI source.
- Record SessionStart metadata checks, plugin reload/update behavior, newly extracted plugin activation, and failure recovery.
- Record exact commands, versions, output, and blockers in docs/feasibility-report.md.
- Stop after the spike and wait for explicit approval before implementing the remaining workflow.

Full implementation remains gated until the ORAS feasibility spike is complete and explicitly approved. Earlier approval of the skillctl skill-distribution implementation does not approve this changed plugin-bundle workflow.

## Out of scope

- Native OCI source support in or changes to Claude Code's built-in marketplace implementation.
- Installing standalone OCI skill artifacts through skillctl as the manager's primary OCI workflow.
- A command-source marketplace adapter as the primary OCI UX.
- Compass integration or consumption tracking.
- Registry webhooks, push notifications, background polling, or a daemon.
- Security advisory processing or signature enforcement.
- Platforms beyond the initial macOS demo.

This POC demonstrates plugin distribution and updates, not a complete secure supply chain. Signing may follow after the selected ORAS artifact format and registry behavior are verified.

## Implementation constraints

- Use a small marketplace manager, raw OCI source entries, a complete plugin archive, ORAS, a deterministic helper, and the existing mod/SessionStart architecture.
- Keep filesystem, archive, registry, validation, and activation operations in deterministic code, not model-generated shell actions.
- Use only demo Git URLs, registry coordinates, and credentials supplied by the demo setup.
- Treat Claude's registered marketplaces as authoritative; do not maintain an independent marketplace registry.
- Do not download OCI artifact layers during listing, startup checks, or manual refresh.
- Do not add an elaborate specification framework or per-release documentation for this POC.

## Technical references

- [ORAS push](https://oras.land/docs/1.1/commands/oras_push/)
- [ORAS manifest fetch](https://oras.land/docs/1.1/commands/oras_manifest_fetch/)
- [ORAS pull](https://oras.land/docs/1.1/commands/oras_pull/)
- [Claude Code: create a marketplace](https://code.claude.com/docs/en/plugin-marketplaces)
