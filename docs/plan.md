# Implementation Plan

This is the ordered execution tracker for [requirements.md](requirements.md). Product choices belong in [decisions.md](decisions.md), feasibility evidence in [feasibility-report.md](feasibility-report.md), and implementation evidence in [implementation-report.md](implementation-report.md).

## Scope reset — ORAS plugin bundles

On 2026-10-15, the user clarified that skillctl builds OCI artifacts for individual skills, not complete Claude plugins, and requested ORAS integration instead. The current requirements now define each raw OCI marketplace source as a complete plugin bundle. The raw plugins[].source contract and retirement of oci-catalog.json remain in effect.

The existing manager code and earlier skillctl evidence implement an individual-skill payload. They are historical inputs, not proof that the full-plugin ORAS requirements pass. The ORAS feasibility spike must precede implementation. Earlier approval of the skillctl flow does not clear the new implementation gate.

## Tracking rules

Statuses:

- **Backlog** — accepted work that depends on an earlier task or gate.
- **Ready** — dependencies are satisfied and work can start.
- **In progress** — actively being worked; keep only one task in this state.
- **Blocked** — required external input or evidence prevents progress; record the blocker.
- **Done** — every completion item is checked and its evidence is recorded.

Keep each task's implementation, evidence report, and status together. Documentation tasks use reviewed documents as completion evidence. Do not mark implementation or acceptance work done based on expected behavior or documentation alone. Record exact commands, versions, outputs, and blockers. Do not expose credentials, authentication files, or machine-local configuration.

## Current status

- **T600 — Update product documents:** Done. The requirements now specify complete ORAS plugin bundles; the plan places the feasibility spike before implementation; D17 records the scope decision.
- **T607 — ORAS and stock Claude feasibility spike:** Partially run; the Mac local artifact round-trip, strict validation, and native persistent installation pass. The offline raw-source parser/list/add checks also pass 21 tests, and T601 records local raw-source marketplace registration without an OCI request. Registry push/lookup/pull and registry support for candidate media types remain blocked without an approved complete-plugin destination and working credentials; interactive command/restart behavior remains unverified. See the [Mac artifact and activation check](feasibility-report.md#macos-local-artifact-and-activation-check-2026-10-15) and [offline parser check](feasibility-report.md#offline-raw-source-parser-and-manager-command-check-linux-2026-10-15).
- **Gate G3:** Not cleared. Full implementation must wait for the spike evidence and explicit user approval.

## P1 — Product-document reset

### T600 — Record the full-plugin ORAS product direction

- **Status:** Done
- **Requirements:** R3–R9, Feasibility spike, Implementation constraints
- **Depends on:** User direction received 2026-10-15
- **Outcome:** Replace the skillctl payload contract with complete plugin bundles stored as OCI artifacts through ORAS while preserving raw source fields and retired catalog policy.
- **Evidence:** [Requirements](requirements.md), [D17](decisions.md#d17--oras-distribution-of-complete-claude-plugin-bundles), and this plan.
- **Done when:**
  - [x] The spec distinguishes a full plugin bundle from an individual skill artifact.
  - [x] The plan adds the ORAS feasibility spike before implementation.
  - [x] The previous skillctl approval is explicitly scoped as historical.

## P2 — ORAS feasibility and approval gate

### T607 — Verify ORAS artifact and Claude plugin feasibility

- **Status:** Partially run; blocked on registry inputs and Mac-session behavior — the macOS host, ORAS 1.3.4 local artifact round-trip, strict plugin validation, and persistent native installation of the extracted bundle are verified. The offline parser/list/add checks and local raw-source registration also pass without OCI retrieval. Registry push/lookup/pull and registry support for the candidate media types remain untested without an approved complete-plugin destination and working credentials. See the [Mac artifact and activation check](feasibility-report.md#macos-local-artifact-and-activation-check-2026-10-15) and [offline parser check](feasibility-report.md#offline-raw-source-parser-and-manager-command-check-linux-2026-10-15).
- **Requirements:** R1–R9, R12, Feasibility spike
- **Depends on:** T600; demo host, artifact source, registry reference, and credentials supplied by the demo setup
- **Outcome:** Prove generic ORAS artifact publication, metadata-only digest lookup, digest-pinned retrieval, validation of the complete plugin, and persistent activation in stock Claude Code.
- **Evidence:** Partial local evidence is in [feasibility-report.md](feasibility-report.md#macos-local-artifact-and-activation-check-2026-10-15). Existing [raw-source compatibility evidence](feasibility-report.md#oci-source-marketplace-compatibility-spike) covers only historical source parsing and marketplace registration. The old [T501 registry evidence](implementation-report.md#t501--end-to-end-demo-rehearsal) is skillctl-specific.
- **Done when:**
  - [x] The actual macOS, Claude Code, ORAS, and Git versions are recorded.
  - [ ] A complete plugin archive with .claude-plugin/plugin.json is published to the supplied registry using the selected artifact type and layer media type.
  - [ ] ORAS manifest lookup returns the expected digest and version metadata without downloading artifact layers.
  - [ ] ORAS retrieves the artifact by digest using supplied local credentials; the fetched archive matches the recorded digest.
  - [x] Claude validates the locally extracted plugin directory and it activates persistently through the native local-marketplace install path. Registry-backed activation remains pending.
  - [x] Raw-source marketplace registration and manager parsing succeed without OCI retrieval during registration or listing. Evidence: T601 local registration and the offline parser/list/add test check; Mac interactive confirmation remains pending.
  - [ ] Commands, exact output, activation/reload behavior, and blockers are recorded without exposing credentials.

### Gate G3 — Approve implementation of the ORAS flow

- **Status:** Not cleared — awaiting completion of T607 and explicit user approval.
- **Requirements:** Feasibility spike
- **Depends on:** T607
- **Entry condition:** T607 has complete evidence and all feasibility blockers are reported.
- **Exit condition:** The user explicitly approves implementation of the verified ORAS package and activation path.
- **Evidence:** User approval and the completed T607 report.

## P3 — Full-plugin OCI implementation

### T608 — Define and publish the complete plugin artifact

- **Status:** Backlog
- **Requirements:** R3–R5, Demo acceptance 1–2
- **Depends on:** Gate G3
- **Outcome:** Add a small complete plugin example and reproducible ORAS packaging/publishing steps using only supplied registry coordinates.
- **Evidence:** [Implementation report](implementation-report.md), after implementation.
- **Done when:**
  - [ ] The example is a valid complete Claude plugin directory and preserves all files/components when packaged.
  - [ ] The archive root and project-defined OCI artifact/layer media types match the T607 result.
  - [ ] OCI title and version annotations match the plugin manifest.
  - [ ] The supplied registry reference is recorded; no registry coordinate is guessed.
  - [ ] The published artifact is inspectable by digest with ORAS and validated by Claude after extraction.

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
  - [ ] Fixtures cover valid/invalid OCI references, mixed and standard-only marketplaces, and archive/media-type metadata.
  - [ ] Listing and metadata checks prove they do not retrieve OCI layers.
  - [ ] Permission denial and dismissal do not alter installed files or state.
  - [ ] Selected same-tag updates use the resolved digest and activate the complete plugin.
  - [ ] Injected pull, digest, extraction, validation, and activation failures preserve the prior working plugin.

## P4 — Acceptance and user documentation

### T613 — Rehearse the end-to-end macOS flow

- **Status:** Backlog
- **Requirements:** R1–R14, Demo acceptance 1–9
- **Depends on:** T608–T612; supplied bootstrap and demo Git URLs; supplied registry configuration
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
  - [ ] Prerequisites and exact ORAS packaging/publishing commands use only supplied coordinates.
  - [ ] Bootstrap and demo marketplace URLs remain distinct.
  - [ ] The expected v1/v2 plugin behavior, evidence gates, and cleanup are documented.
  - [ ] The guide is replayed against the completed acceptance flow.
  - [ ] README, requirements, decisions, and plan agree on the full-plugin ORAS boundary.

## Historical evidence

The P0–P5 work and T601–T604 establish the Claude marketplace shell, manager UX, raw-source marketplace parsing, and the earlier skillctl-based individual-skill lifecycle. Their reports remain useful evidence for those areas, but the skill payload, skill installation location, skill reload behavior, and skillctl publication steps do not satisfy this plan's full-plugin OCI requirements. T605's earlier registry authorization blocker applies to the old skill artifacts and must be rechecked for ORAS.
