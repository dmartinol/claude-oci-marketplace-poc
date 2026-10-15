# Implementation Plan

This is the ordered execution tracker for [requirements.md](requirements.md). Product choices belong in [decisions.md](decisions.md), feasibility evidence in [feasibility-report.md](feasibility-report.md), and implementation evidence in [implementation-report.md](implementation-report.md).

## Scope reset — ORAS plugin bundles

On 2026-10-15, the user clarified that skillctl builds OCI artifacts for individual skills, not complete Claude plugins, and requested ORAS integration instead. The current requirements now define each raw OCI marketplace source as a complete plugin bundle. The raw plugins[].source contract and retirement of oci-catalog.json remain in effect.

The existing manager code and earlier skillctl evidence implement an individual-skill payload. They are historical inputs, not proof that the full-plugin ORAS requirements pass. The user approved direct ORAS directory publication on 2026-10-15. The POC owns all complete plugin source and artifact tags: T607 uses the existing manager plugin for its spike artifact, and T608 creates the separate v1/v2 demo plugin. The supplied registry configuration provides the repository and credentials, not a prebuilt artifact or tag. Per D21, current T607/T608 checks run on the configured Mac; the Linux sandbox results remain historical. Direct-directory registry retrieval remains part of T607.

## Tracking rules

Statuses:

- **Backlog** — accepted work that depends on an earlier task or gate.
- **Ready** — dependencies are satisfied and work can start.
- **In progress** — actively being worked; keep only one task in this state.
- **Blocked** — required external input or evidence prevents progress; record the blocker.
- **Done** — every completion item is checked and its evidence is recorded.

Keep each task's implementation, evidence report, and status together. Documentation tasks use reviewed documents as completion evidence. Do not mark implementation or acceptance work done based on expected behavior or documentation alone. Record exact commands, versions, outputs, and blockers. Do not expose credentials, authentication files, or machine-local configuration.

## Current status

- **T600 — Update product documents:** Done. The requirements specify complete ORAS plugin bundles and make the POC responsible for building its own bundle source and tags; D17/D18 record the product direction and artifact ownership.
- **T607 — ORAS and stock Claude feasibility spike:** Blocked after partial Mac run. Local direct-directory publishing, digest-pinned OCI-layout pulls, strict plugin validation, and persistent native local-marketplace installation pass. An earlier archived manager bundle was published to the supplied Quay repository and its manifest descriptor resolved; the direct-directory layer and registry pull by digest remain unverified. See the [Mac artifact and activation check](feasibility-report.md#macos-local-artifact-and-activation-check-2026-10-15), [direct-directory ORAS check](feasibility-report.md#direct-directory-oras-check-macos-2026-10-15), and [Linux sandbox check](feasibility-report.md#linux-current-host-feasibility-check-2026-10-15).
- **Gate G3:** The user approved the direct-directory ORAS approach on 2026-10-15. Registry retrieval evidence remains part of T607; this plan does not claim the complete lifecycle has passed.
- **T608 — Build and publish project-owned v1/v2 demo plugin:** In progress. The project-owned sources, direct-folder OCI-layout push/pull for both versions, same-tag digest change, and strict validation after pull are complete locally. Publishing the direct-directory layer to the configured registry and final end-to-end activation remain open. See the [T608 source and local direct-directory evidence](feasibility-report.md#direct-directory-oras-check-macos-2026-10-15).

User-requested OpenShell installer alignment (2026-10-15) is complete at source level: ORAS replaces skillctl in image installation, build arguments, registry checks, and network policy. Local syntax and mocked command checks pass; image build/live registry validation remains unavailable in this sandbox. See [implementation evidence](implementation-report.md#openshell-oras-installer-alignment-2026-10-15). T607 and lifecycle task statuses remain as recorded above.

## P1 — Product-document reset

### T600 — Record the full-plugin ORAS direction and artifact ownership

- **Status:** Done
- **Requirements:** R3–R9, Feasibility spike, Implementation constraints
- **Depends on:** User direction received 2026-10-15
- **Outcome:** Replace the skillctl payload contract with complete plugin directories published as OCI artifacts through ORAS, and assign the POC ownership of all source bundles and tags.
- **Evidence:** [Requirements](requirements.md), [D17](decisions.md#d17--oras-distribution-of-complete-claude-plugin-bundles), [D18](decisions.md#d18--the-project-owns-demo-plugin-sources-and-artifact-tags), and this plan.
- **Done when:**
  - [x] The spec distinguishes a full plugin bundle from an individual skill artifact.
  - [x] The plan adds the ORAS feasibility spike before implementation.
  - [x] The previous skillctl approval is explicitly scoped as historical.
  - [x] The POC owns the spike bundle, v1/v2 demo source, and tag generation; ORAS publishes the plugin directories directly, so no separate packaging tool or prebuilt full-plugin artifact is an external dependency.

## P2 — ORAS feasibility and approval gate

### T607 — Verify ORAS artifact and Claude plugin feasibility

- **Status:** Blocked after partial run on the Mac host. Local direct-directory push/pull and validation pass. The earlier remote archived-bundle publication and descriptor lookup do not verify registry support for the direct-directory layer or remote retrieval by digest.
- **Requirements:** R1–R9, R12, Feasibility spike
- **Depends on:** T600; the configured Mac host with stock Claude Code. The configured registry repository and supported local credentials are inputs; this project supplies the bundle and tag. Linux sandbox results are historical. Final macOS demo acceptance remains under T613.
- **Outcome:** Prove generic ORAS artifact publication, metadata-only digest lookup, digest-pinned retrieval, validation of the complete plugin, and persistent activation in stock Claude Code.
- **Evidence:** Mac direct-directory evidence is in [feasibility-report.md](feasibility-report.md#direct-directory-oras-check-macos-2026-10-15); native activation evidence is in the [Mac artifact and activation check](feasibility-report.md#macos-local-artifact-and-activation-check-2026-10-15). Raw-source compatibility evidence is in the [offline parser check](feasibility-report.md#offline-raw-source-parser-and-manager-command-check-linux-2026-10-15). Earlier archived-bundle registry evidence is recorded separately and does not verify the direct-directory layer.
- **Done when:**
  - [x] Mac OS, Claude Code, ORAS, and Git versions are recorded.
  - [x] The maintained manager plugin and v1/v2 demo plugin publish directly from their roots to a local OCI layout; pulled directory roots contain `.claude-plugin/plugin.json`.
  - [ ] The maintained manager plugin is published from its root to the configured registry under its project-generated spike tag using the direct-directory layer type.
  - [ ] Registry manifest lookup returns the expected digest and version metadata without downloading artifact layers.
  - [ ] ORAS retrieves the direct-directory artifact by digest using the supplied local credentials; Claude validation passes on the pulled root.
  - [x] Claude 2.1.299 validates an extracted complete plugin and persistently installs it through a temporary native local marketplace on Linux. Registry-backed activation remains pending.
  - [x] Raw-source marketplace registration and manager parsing succeed without OCI retrieval during registration or listing. Evidence: T601 local registration and the offline parser/list/add check; Mac first-demo interactive acceptance remains under T613.
  - [ ] Interactive component invocation, session/restart behavior, and registry-backed activation are verified; current shell limitations are recorded.
  - [ ] Commands, exact output, activation/reload behavior, and remaining blockers are recorded without exposing credentials.

### Gate G3 — Approve implementation of the ORAS flow

- **Status:** Approach approved; T607 evidence remains incomplete for remote direct-directory retrieval.
- **Requirements:** Feasibility spike
- **Depends on:** T607
- **Entry condition:** T607 records the actual direct-directory artifact contract and outstanding registry/activation evidence.
- **Exit condition:** T607's required checks pass and the user has approved the resulting implementation path. The user approved direct-directory publication; remote digest-pinned retrieval remains open.
- **Evidence:** User's 2026-10-15 implementation instruction and the completed T607 report.

## P3 — Full-plugin OCI implementation

### T608 — Build and publish the project-owned v1/v2 demo plugin

- **Status:** In progress; source and local direct-directory ORAS publication are verified, while configured-registry publication remains open under T607.
- **Requirements:** R3–R5, Demo acceptance 1–2
- **Depends on:** T600 for project-owned source; T607 for registry media types, publication, and ORAS inspection. User authorized the source and direct-directory publication work on 2026-10-15.
- **Outcome:** Create the complete demo plugin source and both behavior versions in this repository, then publish each plugin root to the supplied repository using a project-owned mutable tag. No prebuilt source, artifact, or tag is requested from the demo operator.
- **Evidence:** [T608 source and local direct-directory evidence](feasibility-report.md#direct-directory-oras-check-macos-2026-10-15) and the [historical packaging correction](implementation-report.md#correction--direct-oras-folder-publication-2026-10-15).
- **Done when:**
  - [x] The repository contains complete v1/v2 plugin roots at `examples/oci-demo-plugin/v1` and `/v2`, each with `.claude-plugin/plugin.json` and a component with distinct version behavior.
  - [x] Claude strict validation passes for both source plugin roots.
  - [x] ORAS 1.3.4 directly pushes each plugin root as a gzip-compressed OCI layer; pulling by digest yields a root directory accepted by Claude's strict validator.
  - [x] Local OCI-layout v1 and v2 pushes use the same mutable tag and resolve to different manifest digests; the version annotation follows plugin.json.
  - [ ] The direct-directory layer is published to the configured registry and retrieved by digest.
  - [ ] The ORAS publish instructions resolve the repository only from supplied demo configuration and publish both versions to `<configured-repository>:oci-demo-plugin-draft`. The plugin version annotation changes with the source version.
  - [ ] The demo marketplace source points at `<configured-repository>:oci-demo-plugin-draft`; no full-plugin artifact or tag is an external prerequisite.
  - [x] Local OCI-layout artifacts are inspectable by digest with ORAS and validated by Claude after pull.

### T609 — Replace skillctl payload operations with ORAS

- **Status:** Backlog
- **Requirements:** R4–R8, R12
- **Depends on:** T608
- **Outcome:** Use deterministic ORAS operations for metadata-only manifest lookup and approval-gated digest-pinned bundle retrieval.
- **Evidence:** [Implementation report](implementation-report.md), after implementation.
- **Done when:**
  - [ ] Marketplace discovery reads raw OCI references from registered marketplace manifests and keeps standard-only entries visible.
  - [ ] Listing performs no registry request; startup and refresh inspect manifests without retrieving layers.
  - [ ] Same-tag digest changes are associated with the correct marketplace-qualified plugin.
  - [ ] Install retrieval begins only after native confirmation and Claude permission.
  - [ ] No plugin payload operation depends on skillctl.

### T610 — Validate, activate, update, and roll back plugin bundles

- **Status:** Backlog
- **Requirements:** R5–R8
- **Depends on:** T607, T609
- **Outcome:** Install complete plugin directories by the T607-proven supported Claude path, retaining working installations on failure.
- **Evidence:** [Implementation report](implementation-report.md), after implementation.
- **Done when:**
  - [ ] Bundles are staged by inspected digest, extracted with path containment, and checked against plugin name/version metadata.
  - [ ] Claude's supported plugin validator accepts the staged plugin.
  - [ ] The plugin activates in the active Claude config without writing undocumented Claude state.
  - [ ] A successful update activates the replacement and records the new version/digest.
  - [ ] Retrieval, digest, extraction, validation, or activation failures leave the prior active plugin and record usable.
  - [ ] The demonstrated reload or next-session behavior is recorded.

### T611 — Align manager commands and state with plugins

- **Status:** Backlog
- **Requirements:** R2, R5, R9–R14
- **Depends on:** T609, T610
- **Outcome:** Present marketplace-qualified OCI plugins and per-plugin update choices throughout commands, state, and mod UI.
- **Evidence:** [Implementation report](implementation-report.md), after implementation.
- **Done when:**
  - [ ] User-visible names, installed records, and update summaries describe plugins, not individual OCI skills.
  - [ ] /marketplace-manager supports list, add, direct qualified install, installed-state display, and selected updates.
  - [ ] Standard-only marketplaces remain visible and standard plugin operations remain native.
  - [ ] Update alerts are non-blocking and dismissal lasts only for the current session.
  - [ ] User approval and Claude permission precede all OCI bundle retrieval.

### T612 — Add deterministic coverage for the revised contract

- **Status:** Backlog
- **Requirements:** R3–R14
- **Depends on:** T609, T610, T611
- **Outcome:** Cover full-plugin OCI source parsing, lifecycle, activation, and rollback without live registry credentials.
- **Evidence:** [Implementation report](implementation-report.md), after implementation.
- **Done when:**
  - [ ] Fixtures cover valid/invalid OCI references, mixed and standard-only marketplaces, and artifact/layer metadata.
  - [ ] Listing and metadata checks prove they do not retrieve OCI layers.
  - [ ] Permission denial and dismissal do not alter installed files or state.
  - [ ] Selected same-tag updates use the resolved digest and activate the complete plugin.
  - [ ] Injected pull, digest, extraction, validation, and activation failures preserve the prior working plugin.

## P4 — Acceptance and user documentation

### T613 — Rehearse the end-to-end macOS flow

- **Status:** Backlog
- **Requirements:** R1–R14, Demo acceptance 1–9
- **Depends on:** T608–T612; supplied bootstrap and demo Git URLs; supplied registry configuration and usable local credentials
- **Outcome:** Run the complete install/update flow from a fresh Claude profile and record observable results.
- **Evidence:** [Implementation report](implementation-report.md), after rehearsal.
- **Done when:**
  - [ ] The manager bootstrap and demo marketplace use distinct Git sources.
  - [ ] The manager lists the supplied OCI plugin without fetching its artifact layers.
  - [ ] An approved install activates the complete v1 plugin and its component in Claude.
  - [ ] A changed digest at the same tag is detected and a selected v2 update is activated.
  - [ ] A standard-only marketplace remains visible and usable through Claude's native interface.
  - [ ] Failure injection preserves the prior active plugin.
  - [ ] Commands, versions, output, digests, restart behavior, and blockers are recorded without secrets.

### T614 — Publish verified ORAS demo guidance

- **Status:** Backlog
- **Requirements:** Demo acceptance, Documentation
- **Depends on:** T613
- **Outcome:** Document a replayable full-plugin ORAS workflow and keep root developer guidance consistent with requirements and decisions.
- **Evidence:** [Demo guide](demo/README.md), after completion.
- **Done when:**
  - [ ] Prerequisites and exact ORAS directory-publishing commands use the supplied registry repository and the project's documented tag-generation convention.
  - [ ] Bootstrap and demo marketplace URLs remain distinct.
  - [ ] The expected v1/v2 plugin behavior, evidence gates, and cleanup are documented.
  - [ ] The guide is replayed against the completed acceptance flow.
  - [ ] README, requirements, decisions, and plan agree on the full-plugin ORAS boundary.

## Historical evidence

The P0–P5 work and T601–T604 establish the Claude marketplace shell, manager UX, raw-source marketplace parsing, and the earlier skillctl-based individual-skill lifecycle. Their reports remain useful evidence for those areas, but the skill payload, skill installation location, skill reload behavior, and skillctl publication steps do not satisfy this plan's full-plugin OCI requirements. T605's earlier registry authorization blocker applies to the old skill artifacts and must be rechecked for ORAS.
