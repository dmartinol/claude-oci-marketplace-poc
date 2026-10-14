# Implementation Plan

This document is the execution tracker for the requirements in [requirements.md](requirements.md). Product intent belongs in the requirements, rationale belongs in [decisions.md](decisions.md), feasibility evidence belongs in [feasibility-report.md](feasibility-report.md), and P1–P5 implementation evidence belongs in [implementation-report.md](implementation-report.md).

## Tracking rules

Statuses:

- **Backlog** — accepted but not yet actionable.
- **Ready** — dependencies are satisfied and work may start.
- **In progress** — actively being worked; keep only one task in this state.
- **Blocked** — cannot continue; record the blocker and supporting evidence.
- **Done** — every required checklist item is checked and its evidence is recorded.

For P1–P5, the checklist under each task is its acceptance gate. Check an item only after observing the result and recording its evidence under that task in `docs/implementation-report.md`; a task cannot be marked Done while any required item is unchecked. Keep implementation, report, and plan status updates together in a task-specific commit, then push that commit to `origin/main`. Record failed commands, blockers, and push failures in the report and plan, then continue with independent work. If work changes intended behavior, update the requirements and decisions before changing this plan.

## Current priority

The feasibility spike is complete and the user explicitly approved full implementation on 2026-10-14. On 2026-10-14, the user clarified that the product is a general marketplace manager and OCI support is an extension. T304 is complete; continue with T501, T502, and T503 in dependency order, preserving each outcome and blocker.

## P0 — Feasibility spike

### T001 — Inventory the demo environment

- **Status:** Done
- **Requirements:** R1, R4, R9
- **Depends on:** None
- **Outcome:** Establish the actual macOS, Claude Code, `skillctl`, Git, and registry environment used by the demo.
- **Evidence:** `docs/feasibility-report.md#environment`
- **Done when:**
  - [x] macOS and executable locations are recorded.
  - [x] `claude --version` and the supported `skillctl --version` output are recorded.
  - [x] The supplied registry configuration is confirmed available without exposing credentials.

### T002 — Prove standard marketplace integration

- **Status:** Done
- **Requirements:** R2, R9
- **Depends on:** T001
- **Outcome:** Prove that the repository can be a valid Claude marketplace containing one installable manager plugin.
- **Evidence:** `docs/feasibility-report.md#standard-marketplace`
- **Done when:**
  - [x] A minimal marketplace and manager plugin shape passes `claude plugin validate`.
  - [x] The repository can be added as a marketplace from its Git URL.
  - [x] `/plugin` displays the marketplace and manager plugin.
  - [x] The manager plugin can be installed and enabled.

### T003 — Verify the mod interaction model

- **Status:** Done
- **Requirements:** R2, R9, R13, R14
- **Depends on:** T002
- **Outcome:** Establish whether the required deterministic command and native update interaction are supported.
- **Evidence:** `docs/feasibility-report.md#mod-apis`
- **Done when:**
  - [x] Mod support is confirmed for the installed Claude version.
  - [x] A deterministic namespaced command is registered and its exact name is recorded.
  - [x] A non-blocking indicator and native confirmation dialog are demonstrated.
  - [x] The transition from confirmation to Claude's standard permission flow is demonstrated or documented as a blocker.

### T004 — Verify registered-marketplace discovery

- **Status:** Done
- **Requirements:** R10, R11, R12
- **Depends on:** T002
- **Outcome:** Discover compatible catalogs from Claude's authoritative registration state without creating a second registry.
- **Evidence:** `docs/feasibility-report.md#marketplace-discovery`
- **Done when:**
  - [x] User-level marketplace registrations can be enumerated.
  - [x] Registered source URLs can be mapped to usable marketplace content or caches.
  - [x] OCI-enabled and standard-only marketplaces can be distinguished.
  - [x] Adding a standard-only marketplace retains standard Claude behavior.

### T005 — Verify `skillctl` capabilities

- **Status:** Done
- **Requirements:** R3, R4, R5, R7
- **Depends on:** T001 and supplied registry coordinates
- **Outcome:** Prove metadata resolution, authentication reuse, retrieval, and unpacking against the configured demo registry.
- **Evidence:** `docs/feasibility-report.md#skillctl`
- **Done when:**
  - [x] Supported commands and artifact layout are recorded.
  - [x] A resolved digest can be obtained without downloading artifact layers.
  - [x] One supplied or purpose-built sample skill can be retrieved and unpacked.
  - [x] Authentication and common failure behavior are documented without exposing credentials.

### T006 — Verify skill discovery and reload

- **Status:** Done
- **Requirements:** R6, R9
- **Depends on:** T005
- **Outcome:** Determine the standard Claude lifecycle required to make new and updated skill directories invocable.
- **Evidence:** `docs/feasibility-report.md#skill-reload`
- **Done when:**
- [x] A newly unpacked sample skill is discovered by Claude.
- [x] Replacement of an existing skill is tested.
- [x] `reloadSkills`, `/reload-plugins`, and next-session behavior are recorded as applicable.
- [x] The selected standard reload behavior is documented without adding custom hot reload.

### T007 — Resolve the OCI catalog contract

- **Status:** Done
- **Requirements:** R3, R5, R12
- **Depends on:** T004, T005
- **Outcome:** Select the extension-owned catalog filename and its minimum validated schema.
- **Evidence:** `docs/feasibility-report.md#oci-catalog`
- **Done when:**
- [x] The filename and discovery location are recorded.
- [x] Required catalog and skill fields are defined.
- [x] Version, tag, repository, and resolved-digest semantics are defined.
- [x] `<skill-name>@<marketplace-name>` identity and duplicate-name behavior are demonstrated.

### T008 — Publish the feasibility report

- **Status:** Done
- **Requirements:** R1–R14
- **Depends on:** T001–T007
- **Outcome:** Provide enough evidence to approve, revise, or stop the full implementation.
- **Evidence:** `docs/feasibility-report.md`
- **Done when:**
- [x] Commands, relevant output, observed APIs, and limitations are recorded.
- [x] Every open feasibility question in `docs/decisions.md` is answered or marked blocked.
- [x] Requirement conflicts and proposed changes are explicitly listed.
- [x] The report ends with a clear go, revise, or no-go recommendation.
- [x] Work stops at Gate G1.

## Gate G1 — Explicit approval

- **Status:** Done — explicit user approval recorded 2026-10-14
- **Entry condition:** T001–T008 are Done.
- **Exit condition:** The feasibility evidence and any proposed requirement changes are reviewed and full implementation is explicitly approved.
- **Evidence:** User approved the plan in chat after asking what remained for a viable MVP and receiving the G1 explanation.
- **Result:** P1–P5 are authorized to proceed.

## P1 — Production-shaped plugin scaffold

### T101 — Establish the validated marketplace and plugin scaffold

- **Status:** Done
- **Requirements:** R2, R3, R9
- **Depends on:** G1
- **Evidence:** [Implementation report — T101](implementation-report.md#t101--validated-plugin-scaffold)
- **Outcome:** Convert validated spike assets into the minimal maintained marketplace, manager plugin, mod entry point, `SessionStart` hook, helper, and sample catalog structure.
- **Completion checks:**
  - [x] `claude plugin validate --strict .` accepts the root marketplace.
  - [x] `claude plugin validate --strict ./plugins/oci-marketplace` accepts the manager plugin.
  - [x] OCI metadata is in the extension-owned root catalog while Claude's standard marketplace manifest remains valid.
  - [x] The packaged `SessionStart` hook returns Claude's supported `reloadSkills` response.
  - [x] After marketplace installation/update and a fresh stock Claude session, `/oci-marketplace` exposes the namespaced command.

### T102 — Automate structural validation

- **Status:** Done
- **Requirements:** R2, R3, R9
- **Depends on:** T101
- **Evidence:** [Implementation report — T102](implementation-report.md#t102--structural-validation)
- **Outcome:** Add repeatable checks for marketplace metadata, plugin metadata, the OCI catalog schema, and fixture integrity.
- **Completion checks:**
  - [x] Catalog fixtures accept required fields and a tagged OCI repository reference, and reject missing or invalid fields.
  - [x] Duplicate skill names within one catalog are rejected; the same name in separate marketplaces produces distinct qualified identities.
  - [x] Standard-only marketplaces contribute no OCI entries.
  - [x] Metadata parsing and shell argument quoting have repeatable unit coverage.
  - [x] Disposable installation fixtures cover fetch, digest mismatch, invalid artifact, and activation failures, preserving the prior installation.
  - [x] Strict Claude marketplace/plugin validation and local tests pass without registry credentials.

## P2 — Deterministic marketplace and skill core

### T201 — Implement marketplace discovery and catalog loading

- **Status:** Done
- **Requirements:** R3, R10, R11, R12
- **Depends on:** T101, T102
- **Evidence:** [Implementation report — T201](implementation-report.md#t201--marketplace-discovery-and-catalog-loading)
- **Outcome:** Load validated OCI catalogs from Claude's registered marketplaces while preserving standard-only marketplaces.
- **Completion checks:**
  - [x] Registered marketplaces are read from Claude's `claude plugin marketplace list --json` output and their `installLocation` values.
  - [x] Multiple OCI catalogs load, while a registered marketplace without `oci-catalog.json` contributes no OCI entries.
  - [x] Same-name skills in different marketplaces retain distinct `<skill-name>@<marketplace-name>` identities.
  - [x] The live browse command resolves the sample version and digest with `skillctl inspect` and does not pull artifact layers.
  - [x] A headless browse returns the listing without selecting or installing a skill.

### T202 — Implement installed-skill state

- **Status:** Done
- **Requirements:** R5, R12
- **Depends on:** T201
- **Evidence:** [Implementation report — T202](implementation-report.md#t202--installed-skill-state)
- **Outcome:** Persist and display installed version, source reference, marketplace identity, and resolved digest without storing credentials.
- **Completion checks:**
  - [x] A successful install writes a validated record keyed by marketplace-qualified identity only after the install helper succeeds.
  - [x] The record contains skill name, marketplace, repository/source registry, installed version, resolved digest, and install directory; it contains no credentials.
  - [x] A later command reads the persisted record and associates it with the matching catalog entry.
  - [x] The installed view displays version, source registry, and digest from the persisted record.
  - [x] Cancelled or failed installs leave the previous record unchanged.

### T203 — Implement the deterministic `skillctl` wrapper

- **Status:** Done
- **Requirements:** R4, R7
- **Depends on:** T101 and the T005 findings
- **Evidence:** [Implementation report — T203](implementation-report.md#t203--deterministic-skillctl-operations)
- **Outcome:** Provide bounded operations for metadata resolution, retrieval, and unpacking with structured results and errors.
- **Completion checks:**
  - [x] Metadata inspection returns version and resolved digest without pulling artifact layers.
  - [x] Pull/unpack uses the locally supplied registry configuration and supported credentials without exposing or persisting them.
  - [x] Process arguments are passed deterministically, with bounded execution and clear handling for nonzero exits, malformed output, and timeouts.
  - [x] Retrieval occurs only after user confirmation and Claude's standard permission flow.

### T204 — Implement staged installation and replacement

- **Status:** Done
- **Requirements:** R4, R8
- **Depends on:** T202, T203
- **Evidence:** [Implementation report — T204](implementation-report.md#t204--staged-installation-and-replacement)
- **Outcome:** Install and update through validation and atomic replacement while preserving the working installation on failure.
- **Completion checks:**
  - [x] Retrieval stages into a temporary location and validates digest, skill files, and declared skill name before activation.
  - [x] Activation targets a deterministic marketplace-qualified skill directory and replaces it atomically.
  - [x] A successful install/update makes the validated staged skill active and only then updates installed state.
  - [x] Injected fetch, digest, unpack/validation, and activation failures preserve the prior skill and its state.

## P3 — Browse and install workflow

### T301 — Implement marketplace URL registration

- **Status:** Done
- **Requirements:** R10, R11, R12
- **Depends on:** T201
- **Evidence:** [Implementation report — T301](implementation-report.md#t301--marketplace-source-registration)
- **Outcome:** Make the namespaced `add <git-url>` command follow Claude's user-scope marketplace-add behavior and refresh discovery.
- **Completion checks:**
  - [x] `add <git-url>` passes the supplied source as an argument to Claude's user-scope marketplace-add operation.
  - [x] The native Claude permission flow authorizes the deterministic add operation.
  - [x] An OCI-enabled marketplace adds and appears in refreshed discovery.
  - [x] A valid standard-only marketplace adds successfully and contributes no OCI entries.
  - [x] Invalid sources and Claude command failures produce a clear result without corrupting discovery state.

### T302 — Implement the marketplace browser

- **Status:** Done
- **Requirements:** R2, R5, R12
- **Depends on:** T201, T202
- **Evidence:** [Implementation report — T302](implementation-report.md#t302--marketplace-browser)
- **Outcome:** Show available OCI skills, source marketplace, install state, version, and digest through the native mod UI.
- **Completion checks:**
  - [x] The native mod UI lists entries from multiple registered OCI catalogs with qualified identity and marketplace source.
  - [x] Each entry shows available version, source registry, resolved digest, and installed status/version when present.
  - [x] The user can select an install/update entry and cancel or finish browsing without leaving Claude.
  - [x] Browsing and selection resolve metadata only; no artifact content is downloaded before approval.

### T303 — Connect the install and reload flow

- **Status:** Done
- **Requirements:** R4, R6, R8, R13
- **Depends on:** T204, T302
- **Evidence:** [Implementation report — T303](implementation-report.md#t303--install-and-reload-flow)
- **Outcome:** Connect user selection, native confirmation, Claude permission, deterministic installation, and the validated standard reload lifecycle.
- **Completion checks:**
  - [x] Selecting sample v1 presents native confirmation before retrieval.
  - [x] The installation helper runs only after Claude's standard permission flow and installs into the qualified skills directory.
  - [x] Successful installation writes installed state and follows the supported standard reload lifecycle.
  - [x] After the supported reload step, Claude discovers and successfully invokes sample v1.
  - [x] Cancelling confirmation or permission performs no artifact retrieval and changes no installed state.

### T304 — Make the manager general-purpose and list all marketplaces

- **Status:** Done
- **Requirements:** R2, R10, R11, R12
- **Depends on:** T201, T301–T303
- **Evidence:** [Implementation report — T304](implementation-report.md#t304--general-marketplace-manager)
- **Outcome:** Replace the OCI-specific command entry point with the generic marketplace manager, show all registered marketplaces, and retain OCI skill workflows as an extension.
- **Completion checks:**
  - [x] The delivered command is `/marketplace-manager`, accepted by the supported Claude version without colliding with built-in commands or aliases; user-facing command docs, tests, and help use the generic entry point, with historical evidence clearly labeled.
  - [x] A `list` action displays every marketplace from Claude's authoritative registration output, with its name/source and standard-only or OCI-enabled classification.
  - [x] Standard-only marketplace rows remain visible in the manager list while contributing no OCI skill entries to the OCI skill browser.
  - [x] `add <source>` registers both standard-only and OCI-enabled marketplaces and refreshes the complete list.
  - [x] OCI browse/install/update behavior remains available for OCI-enabled entries, while standard plugin operations remain available through Claude's `/plugin` UI.
  - [x] Interaction tests cover complete marketplace listing, classification, adding both marketplace types, and the generic command name.

## P4 — Update workflow

### T401 — Implement update detection

- **Status:** Done
- **Requirements:** R7, R9
- **Depends on:** T202, T203
- **Evidence:** [Implementation report — T401](implementation-report.md#t401--update-detection)
- **Outcome:** Check resolved digests on `SessionStart` and manual refresh without pulling artifact content.
- **Completion checks:**
  - [x] Startup and manual refresh inspect installed skills across all registered OCI catalogs without pulling artifact layers.
  - [x] Unchanged resolved digests are reported as current and do not create update alerts.
  - [x] A newer resolved digest is associated with the correct marketplace-qualified installed skill.
  - [x] Missing catalogs and metadata failures are reported without hiding valid results from other marketplaces.

### T402 — Implement update indication and selection

- **Status:** Done
- **Requirements:** R13, R14
- **Depends on:** T003 findings, T401
- **Evidence:** [Implementation report — T402](implementation-report.md#t402--update-indication-and-selection)
- **Outcome:** Show a non-blocking indicator and consolidated update summary with per-skill selection.
- **Completion checks:**
  - [x] Update detection produces one non-blocking indicator and one consolidated native summary.
  - [x] The summary allows selecting a subset of skills from multiple available updates.
  - [x] Dismissing the alert suppresses it for the current session while leaving artifacts untouched.
  - [x] The same still-applicable update is offered again on the next session startup or manual refresh.

### T403 — Apply selected updates safely

- **Status:** Done
- **Requirements:** R6, R8, R13
- **Depends on:** T204, T402
- **Evidence:** [Implementation report — T403](implementation-report.md#t403--selected-update-application)
- **Outcome:** Apply only selected updates after native confirmation and Claude permission, then follow the standard reload lifecycle.
- **Completion checks:**
  - [x] Native confirmation precedes Claude's standard permission flow for selected updates.
  - [x] Only selected skills are retrieved and updated; unselected skills remain unchanged.
  - [x] Successful v2 replacement updates persisted version/digest and follows the supported reload lifecycle.
  - [x] Claude discovers and successfully invokes sample v2 after reload.
  - [x] Injected retrieval, validation, or activation failure preserves the working v1 files and installed-state record.

## P5 — Demo hardening and developer guidance

### T501 — Exercise the complete demo acceptance flow

- **Status:** Blocked — the checkpoint rehearsal config and macOS toolchain are unavailable in this execution environment.
- **Requirements:** R1–R14
- **Depends on:** T301–T304, T401–T403, supplied registry coordinates
- **Evidence:** [Implementation report — T501](implementation-report.md#t501--end-to-end-demo-rehearsal)
- **Outcome:** Run all acceptance scenarios from a clean macOS environment using two uniquely named v1/v2 skills in the supplied Quay namespace.
- **Progress:** The supplied checkpoint reports both skills installed and updated through plugin v0.3.2, demo v2 invoked, and guide v1 invoked; guide v2 invocation and rechecking installed records remain. In this execution environment the requested macOS checkout, both supplied rehearsal paths, and `skillctl` are absent; Claude Code is 2.1.156 rather than the tested 2.1.299. The unavailable live checks are recorded in the implementation report and remain open.
- **Completion checks:**
  - [x] Strict repository validation passes; a clean macOS config adds the supplied Git URL and enables the manager, and the live `/plugin` listing was verified in T002.
  - [x] A standard-only marketplace registers and the OCI skill browser excludes it from OCI skill entries; the disposable registration is removed after the check.
  - [ ] The generic manager's live marketplace list shows all registered standard-only and OCI-enabled marketplaces with correct classifications.
  - [x] Catalog fixtures prove cross-marketplace marketplace-qualified identity for same-name skills and reject duplicate names within one catalog. Keep live demo skill names unique per D10.
  - [x] Sample v1 was published in the supplied Quay repository and metadata browsing used `skillctl inspect` without pulling artifact layers.
  - [x] The approved install displayed version, source, and digest; sample v1 was invoked after standard reload.
  - [x] Sample v2 was detected in the live environment; multi-update summary, subset selection, and dismissal are covered by two-marketplace fixtures.
  - [x] Dismissal suppresses the alert for the current session and the fixture offers the update again under a new session ID.
  - [x] An approved selected update followed native confirmation and Claude permission; sample v2 was invoked after standard reload.
  - [x] Injected fetch, digest, validation, and activation failures preserve the working v1 installation.
  - [ ] Recheck both installed v2 records and supplied digests in the isolated config, then invoke guide v2 and observe its expected response.
  - [x] The live demo loads a second OCI marketplace with a distinct skill name so multiple unique-skill updates can be shown without exercising the accepted duplicate-name caveat.

### T502 — Publish verified installation and usage guidance

- **Status:** Backlog — revise and verify the guide after T304's generic command and unified marketplace list are implemented.
- **Requirements:** R1, R2, R6, R10, R11
- **Depends on:** T304, T501
- **Evidence:** [Implementation report — T502](implementation-report.md#t502--readme-guidance)
- **Outcome:** Provide reproducible clean setup, installation, multi-marketplace v1-to-v2, permission, and reload instructions.
- **Progress:** README now includes the full two-catalog procedure and expected versions, digests, and invocation responses. Its generated local catalogs pass available marketplace validation and their documented v1-to-v2 tag transition is asserted. Live verification is pending the supported Claude/`skillctl` rehearsal environment.
- **Completion checks:**
  - [x] README prerequisites and setup steps are verified on an isolated Claude config on macOS.
  - [x] README records the tested marketplace registration and manager installation path.
  - [x] README documents each manager command, approval/permission step, supplied registry reference, and reload step.
  - [ ] README explains the all-marketplace list, standard-only classification, generic command name, and the OCI extension boundary.
  - [ ] A clean user reproduces the acceptance flow using only the README and locally supplied registry credentials/configuration.

### T503 — Final validation and secret review

- **Status:** Backlog — the prior audit covered the narrower OCI-only scope; rerun after T304 and T502.
- **Requirements:** R1–R14
- **Depends on:** T304, T501, and T502 outcomes and remaining acceptance gaps recorded
- **Evidence:** [Implementation report — T503](implementation-report.md#t503--final-validation-and-verdict)
- **Outcome:** Confirm repository integrity, documentation consistency, failure behavior, and absence of credentials or machine-local configuration.
- **Progress:** Strict marketplace/plugin validation and installer failure checks pass in this container. The unchanged v0.3.2 implementation passed all 23 plugin tests in the supported Claude Code 2.1.299 environment recorded under T501. The current Claude Code 2.1.156 cannot rerun `claude plugin test`, and `skillctl` is unavailable; both limits and all acceptance results are recorded in the report. Local links and tracked content were reviewed.
- **Completion checks:**
  - [x] Strict marketplace/plugin validation, unit tests, and installation failure-injection checks pass on the final implementation.
  - [x] Each demo acceptance scenario and documented failure case has a recorded pass, partial, or pending result.
  - [x] README, requirements, decisions, plan, and implementation report agree on behavior and status; local documentation links resolve.
  - [x] Git review finds no credentials, tokens, generated authentication files, machine-local configuration, or `.serena/` content staged or tracked.
  - [x] The implementation verdict and remaining limitations are recorded, then this audit commit is pushed to `origin/main`.

