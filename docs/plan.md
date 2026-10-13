# Implementation Plan

This document is the execution tracker for the requirements in [requirements.md](requirements.md). Product intent belongs in the requirements, rationale belongs in [decisions.md](decisions.md), and technical evidence from the first milestone will belong in `docs/feasibility-report.md`.

## Tracking rules

Statuses:

- **Backlog** — accepted but not yet actionable.
- **Ready** — dependencies are satisfied and work may start.
- **In progress** — actively being worked; keep only one feasibility task in this state.
- **Blocked** — cannot continue; record the blocker and supporting evidence.
- **Done** — completion criteria are satisfied and evidence is recorded.

Update a task's status in the same commit as its implementation or evidence. If work changes intended behavior, update the requirements and decisions before changing this plan.

## Current priority

P0 is the only authorized implementation milestone. Complete the feasibility spike, publish its evidence, and stop at Gate G1 for explicit approval. P1–P5 remain backlog until that approval is recorded.

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

- **Status:** Ready
- **Requirements:** R2, R9, R13, R14
- **Depends on:** T002
- **Outcome:** Establish whether the required deterministic command and native update interaction are supported.
- **Evidence:** `docs/feasibility-report.md#mod-apis`
- **Done when:**
  - [ ] Mod support is confirmed for the installed Claude version.
  - [ ] A deterministic namespaced command is registered and its exact name is recorded.
  - [ ] A non-blocking indicator and native confirmation dialog are demonstrated.
  - [ ] The transition from confirmation to Claude's standard permission flow is demonstrated or documented as a blocker.

### T004 — Verify registered-marketplace discovery

- **Status:** Ready
- **Requirements:** R10, R11, R12
- **Depends on:** T002
- **Outcome:** Discover compatible catalogs from Claude's authoritative registration state without creating a second registry.
- **Evidence:** `docs/feasibility-report.md#marketplace-discovery`
- **Done when:**
  - [ ] User-level marketplace registrations can be enumerated.
  - [ ] Registered source URLs can be mapped to usable marketplace content or caches.
  - [ ] OCI-enabled and standard-only marketplaces can be distinguished.
  - [ ] Adding a standard-only marketplace retains standard Claude behavior.

### T005 — Verify `skillctl` capabilities

- **Status:** Backlog
- **Requirements:** R3, R4, R5, R7
- **Depends on:** T001 and supplied registry coordinates
- **Outcome:** Prove metadata resolution, authentication reuse, retrieval, and unpacking against the configured demo registry.
- **Evidence:** `docs/feasibility-report.md#skillctl`
- **Done when:**
  - [ ] Supported commands and artifact layout are recorded.
  - [ ] A resolved digest can be obtained without downloading artifact layers.
  - [ ] One supplied or purpose-built sample skill can be retrieved and unpacked.
  - [ ] Authentication and common failure behavior are documented without exposing credentials.

### T006 — Verify skill discovery and reload

- **Status:** Backlog
- **Requirements:** R6, R9
- **Depends on:** T005
- **Outcome:** Determine the standard Claude lifecycle required to make new and updated skill directories invocable.
- **Evidence:** `docs/feasibility-report.md#skill-reload`
- **Done when:**
  - [ ] A newly unpacked sample skill is discovered by Claude.
  - [ ] Replacement of an existing skill is tested.
  - [ ] `reloadSkills`, `/reload-plugins`, and next-session behavior are recorded as applicable.
  - [ ] The selected standard reload behavior is documented without adding custom hot reload.

### T007 — Resolve the OCI catalog contract

- **Status:** Backlog
- **Requirements:** R3, R5, R12
- **Depends on:** T004, T005
- **Outcome:** Select the extension-owned catalog filename and its minimum validated schema.
- **Evidence:** `docs/feasibility-report.md#oci-catalog`
- **Done when:**
  - [ ] The filename and discovery location are recorded.
  - [ ] Required catalog and skill fields are defined.
  - [ ] Version, tag, repository, and resolved-digest semantics are defined.
  - [ ] `<skill-name>@<marketplace-name>` identity and duplicate-name behavior are demonstrated.

### T008 — Publish the feasibility report

- **Status:** Backlog
- **Requirements:** R1–R14
- **Depends on:** T001–T007
- **Outcome:** Provide enough evidence to approve, revise, or stop the full implementation.
- **Evidence:** `docs/feasibility-report.md`
- **Done when:**
  - [ ] Commands, relevant output, observed APIs, and limitations are recorded.
  - [ ] Every open feasibility question in `docs/decisions.md` is answered or marked blocked.
  - [ ] Requirement conflicts and proposed changes are explicitly listed.
  - [ ] The report ends with a clear go, revise, or no-go recommendation.
  - [ ] Work stops at Gate G1.

## Gate G1 — Explicit approval

- **Status:** Blocked pending completion of T008 and explicit user approval
- **Entry condition:** T001–T008 are Done.
- **Exit condition:** The feasibility evidence and any proposed requirement changes are reviewed and full implementation is explicitly approved.
- **Rule:** Do not start P1–P5 before this gate is cleared.

## P1 — Production-shaped plugin scaffold

### T101 — Establish the validated marketplace and plugin scaffold

- **Status:** Backlog
- **Requirements:** R2, R3, R9
- **Depends on:** G1
- **Outcome:** Convert validated spike assets into the minimal maintained marketplace, manager plugin, mod entry point, `SessionStart` hook, helper, and sample catalog structure.
- **Done when:** the repository validates, installs through `/plugin`, and exposes the confirmed namespaced command.

### T102 — Automate structural validation

- **Status:** Backlog
- **Requirements:** R2, R3, R9
- **Depends on:** T101
- **Outcome:** Add repeatable checks for marketplace metadata, plugin metadata, the OCI catalog schema, and fixture integrity.
- **Done when:** valid fixtures pass, invalid fixtures fail clearly, and the checks run locally without registry credentials.

## P2 — Deterministic marketplace and skill core

### T201 — Implement marketplace discovery and catalog loading

- **Status:** Backlog
- **Requirements:** R3, R10, R11, R12
- **Depends on:** T101, T102
- **Outcome:** Load validated OCI catalogs from Claude's registered marketplaces while preserving standard-only marketplaces.
- **Done when:** multiple catalogs load, missing OCI catalogs are ignored, and skills have stable marketplace-qualified identities.

### T202 — Implement installed-skill state

- **Status:** Backlog
- **Requirements:** R5, R12
- **Depends on:** T201
- **Outcome:** Persist and display installed version, source reference, marketplace identity, and resolved digest without storing credentials.
- **Done when:** installed state can be created, read, validated, and associated with its catalog entry.

### T203 — Implement the deterministic `skillctl` wrapper

- **Status:** Backlog
- **Requirements:** R4, R7
- **Depends on:** T101 and the T005 findings
- **Outcome:** Provide bounded operations for metadata resolution, retrieval, and unpacking with structured results and errors.
- **Done when:** metadata checks do not pull layers and install operations reuse supported registry authentication.

### T204 — Implement staged installation and replacement

- **Status:** Backlog
- **Requirements:** R4, R8
- **Depends on:** T202, T203
- **Outcome:** Install and update through validation and atomic replacement while preserving the working installation on failure.
- **Done when:** successful staging activates a valid skill and simulated failures leave the prior skill usable.

## P3 — Browse and install workflow

### T301 — Implement marketplace URL registration

- **Status:** Backlog
- **Requirements:** R10, R11, R12
- **Depends on:** T201
- **Outcome:** Make the namespaced `add <git-url>` command follow Claude's user-scope marketplace-add behavior and refresh discovery.
- **Done when:** both OCI-enabled and standard-only marketplaces add successfully with the required browser behavior.

### T302 — Implement the marketplace browser

- **Status:** Backlog
- **Requirements:** R2, R5, R12
- **Depends on:** T201, T202
- **Outcome:** Show available OCI skills, source marketplace, install state, version, and digest through the native mod UI.
- **Done when:** skills from multiple catalogs can be browsed and selected without leaving Claude.

### T303 — Connect the install and reload flow

- **Status:** Backlog
- **Requirements:** R4, R6, R8, R13
- **Depends on:** T204, T302
- **Outcome:** Connect user selection, native confirmation, Claude permission, deterministic installation, and the validated standard reload lifecycle.
- **Done when:** sample v1 installs and becomes invocable using the documented standard reload step.

## P4 — Update workflow

### T401 — Implement update detection

- **Status:** Backlog
- **Requirements:** R7, R9
- **Depends on:** T202, T203
- **Outcome:** Check resolved digests on `SessionStart` and manual refresh without pulling artifact content.
- **Done when:** unchanged and newer digests are distinguished reliably across registered catalogs.

### T402 — Implement update indication and selection

- **Status:** Backlog
- **Requirements:** R13, R14
- **Depends on:** T003 findings, T401
- **Outcome:** Show a non-blocking indicator and consolidated update summary with per-skill selection.
- **Done when:** dismissal lasts for the session and the same applicable update returns on the next startup or refresh.

### T403 — Apply selected updates safely

- **Status:** Backlog
- **Requirements:** R6, R8, R13
- **Depends on:** T204, T402
- **Outcome:** Apply only selected updates after native confirmation and Claude permission, then follow the standard reload lifecycle.
- **Done when:** sample v2 becomes invocable and a failed update preserves v1.

## P5 — Demo hardening and developer guidance

### T501 — Exercise the complete demo acceptance flow

- **Status:** Backlog
- **Requirements:** R1–R14
- **Depends on:** T301–T303, T401–T403, supplied registry coordinates
- **Outcome:** Run all acceptance scenarios from a clean macOS environment using sample v1 and v2 in the supplied Quay namespace.
- **Done when:** all acceptance steps in `docs/requirements.md` have reproducible evidence.

### T502 — Publish verified installation and usage guidance

- **Status:** Backlog
- **Requirements:** R1, R2, R6, R10
- **Depends on:** T501
- **Outcome:** Replace the README's pending sections with tested setup, installation, command, permission, and reload instructions.
- **Done when:** a clean user can reproduce the demo by following the README without undocumented steps.

### T503 — Final validation and secret review

- **Status:** Backlog
- **Requirements:** R1–R14
- **Depends on:** T501, T502
- **Outcome:** Confirm repository integrity, documentation consistency, failure behavior, and absence of credentials or machine-local configuration.
- **Done when:** all automated checks pass, documentation links resolve, and the tracked tree contains no secrets.

